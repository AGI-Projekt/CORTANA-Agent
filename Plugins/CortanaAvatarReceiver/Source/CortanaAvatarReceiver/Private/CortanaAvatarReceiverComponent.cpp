#include "CortanaAvatarReceiverComponent.h"

#include "Async/Async.h"
#include "Dom/JsonObject.h"
#include "HAL/PlatformProcess.h"
#include "IWebSocketsModule.h"
#include "Json.h"
#include "Modules/ModuleManager.h"

namespace CortanaReceiver
{
    constexpr int32 MaxMessageCharacters = 16384;

    const TSet<FString> States = { TEXT("idle"), TEXT("listening"), TEXT("thinking"), TEXT("speaking") };
    const TSet<FString> Emotions = {
        TEXT("calm"), TEXT("joy"), TEXT("sadness"), TEXT("anger"),
        TEXT("fear"), TEXT("surprise"), TEXT("disgust"), TEXT("determination")
    };
    const TSet<FString> Visemes = {
        TEXT("neutral"), TEXT("open"), TEXT("mid"), TEXT("wide"),
        TEXT("round"), TEXT("closed"), TEXT("teeth")
    };

    const TArray<FName> Channels = {
        TEXT("browInnerUp"), TEXT("browDown"), TEXT("eyeWide"), TEXT("eyeSquint"),
        TEXT("cheekRaise"), TEXT("jawOpen"), TEXT("mouthSmile"), TEXT("mouthFrown"),
        TEXT("mouthPucker"), TEXT("mouthWide"), TEXT("lipPress"),
        TEXT("upperLipRaise"), TEXT("lowerLipDepress")
    };

    bool ReadFiniteNumber(const TSharedPtr<FJsonObject>& Object, const TCHAR* Field, double& OutValue)
    {
        if (!Object.IsValid() || !Object->TryGetNumberField(Field, OutValue))
        {
            return false;
        }
        return FMath::IsFinite(OutValue);
    }

    bool IsLocalHost(const FString& Host)
    {
        return Host.Equals(TEXT("localhost"), ESearchCase::IgnoreCase)
            || Host.Equals(TEXT("127.0.0.1"), ESearchCase::CaseSensitive)
            || Host.Equals(TEXT("[::1]"), ESearchCase::CaseSensitive)
            || Host.Equals(TEXT("::1"), ESearchCase::CaseSensitive);
    }
}

void FCortanaAvatarFrame::ResetToNeutral()
{
    Sequence = 0;
    TimestampMs = 0.0;
    State = TEXT("idle");
    Emotion = TEXT("calm");
    Viseme = TEXT("neutral");
    AudioLevel = 0.0f;
    Blendshapes.Reset();
    for (const FName Channel : CortanaReceiver::Channels)
    {
        Blendshapes.Add(Channel, 0.0f);
    }
}

UCortanaAvatarReceiverComponent::UCortanaAvatarReceiverComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.bStartWithTickEnabled = true;
    CurrentFrame.ResetToNeutral();
}

void UCortanaAvatarReceiverComponent::BeginPlay()
{
    Super::BeginPlay();
}

void UCortanaAvatarReceiverComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    DisconnectFromEndpoint();
    Super::EndPlay(EndPlayReason);
}

bool UCortanaAvatarReceiverComponent::ConnectToEndpoint(const FString& Url)
{
    if (Url.Len() > 2048)
    {
        return false;
    }

    FURL ParsedUrl(nullptr, *Url, TRAVEL_Absolute);
    const FString Protocol = ParsedUrl.Protocol.ToLower();
    const bool bSecure = Protocol == TEXT("wss");
    const bool bLocalDevelopment = Protocol == TEXT("ws") && CortanaReceiver::IsLocalHost(ParsedUrl.Host);

    if (!bSecure && !bLocalDevelopment)
    {
        UE_LOG(LogTemp, Warning, TEXT("Cortana receiver: remote endpoints require wss://; ws:// is localhost-only."));
        return false;
    }

    if (Socket.IsValid())
    {
        DisconnectFromEndpoint();
    }

    if (!FModuleManager::Get().IsModuleLoaded(TEXT("WebSockets")))
    {
        FModuleManager::Get().LoadModuleChecked<IWebSocketsModule>(TEXT("WebSockets"));
    }

    IWebSocketsModule& WebSockets = FModuleManager::GetModuleChecked<IWebSocketsModule>(TEXT("WebSockets"));
    Socket = WebSockets.CreateWebSocket(Url);

    TWeakObjectPtr<UCortanaAvatarReceiverComponent> WeakThis(this);

    Socket->OnConnected().AddLambda([WeakThis]()
    {
        if (WeakThis.IsValid())
        {
            UE_LOG(LogTemp, Log, TEXT("Cortana avatar receiver connected."));
        }
    });

    Socket->OnConnectionError().AddLambda([WeakThis](const FString& Error)
    {
        if (WeakThis.IsValid())
        {
            UE_LOG(LogTemp, Warning, TEXT("Cortana avatar receiver connection error: %s"), *Error);
        }
    });

    Socket->OnClosed().AddLambda([WeakThis](int32 StatusCode, const FString& Reason, bool bWasClean)
    {
        if (WeakThis.IsValid())
        {
            AsyncTask(ENamedThreads::GameThread, [WeakThis]()
            {
                if (WeakThis.IsValid())
                {
                    WeakThis->ResetFrameAfterTimeout();
                }
            });
        }
    });

    Socket->OnMessage().AddLambda([WeakThis](const FString& Message)
    {
        if (!WeakThis.IsValid() || Message.Len() > CortanaReceiver::MaxMessageCharacters)
        {
            return;
        }

        FCortanaAvatarFrame ParsedFrame;
        FString Error;
        if (!ValidateAndParseMessage(Message, ParsedFrame, Error))
        {
            UE_LOG(LogTemp, Verbose, TEXT("Rejected Cortana avatar frame: %s"), *Error);
            return;
        }

        AsyncTask(ENamedThreads::GameThread, [WeakThis, ParsedFrame]()
        {
            if (WeakThis.IsValid())
            {
                WeakThis->ApplyValidatedFrame(ParsedFrame);
            }
        });
    });

    Socket->Connect();
    return true;
}

void UCortanaAvatarReceiverComponent::DisconnectFromEndpoint()
{
    if (Socket.IsValid())
    {
        Socket->Close();
        Socket.Reset();
    }
    ResetFrameAfterTimeout();
}

bool UCortanaAvatarReceiverComponent::IsConnected() const
{
    return Socket.IsValid() && Socket->IsConnected();
}

void UCortanaAvatarReceiverComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (bHasFrame && (FPlatformTime::Seconds() - LastFrameArrivalSeconds) > FMath::Max(0.1f, FrameTimeoutSeconds))
    {
        ResetFrameAfterTimeout();
    }
}

bool UCortanaAvatarReceiverComponent::ValidateAndParseMessage(const FString& Message, FCortanaAvatarFrame& OutFrame, FString& OutError)
{
    if (Message.IsEmpty() || Message.Len() > CortanaReceiver::MaxMessageCharacters)
    {
        OutError = TEXT("empty or oversized message");
        return false;
    }

    TSharedPtr<FJsonObject> Root;
    const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Message);
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        OutError = TEXT("invalid JSON object");
        return false;
    }

    FString Type;
    if (!Root->TryGetStringField(TEXT("type"), Type) || Type != TEXT("cortana.avatar.frame"))
    {
        OutError = TEXT("unexpected message type");
        return false;
    }

    double Version = 0.0;
    double Sequence = 0.0;
    double TimestampMs = 0.0;
    if (!CortanaReceiver::ReadFiniteNumber(Root, TEXT("version"), Version) || Version != 1.0
        || !CortanaReceiver::ReadFiniteNumber(Root, TEXT("sequence"), Sequence)
        || Sequence < 1.0 || FMath::FloorToDouble(Sequence) != Sequence
        || !CortanaReceiver::ReadFiniteNumber(Root, TEXT("timestampMs"), TimestampMs) || TimestampMs < 0.0)
    {
        OutError = TEXT("invalid protocol version, sequence, or timestamp");
        return false;
    }

    FString State;
    FString Emotion;
    FString Viseme;
    if (!Root->TryGetStringField(TEXT("state"), State) || !CortanaReceiver::States.Contains(State)
        || !Root->TryGetStringField(TEXT("emotion"), Emotion) || !CortanaReceiver::Emotions.Contains(Emotion)
        || !Root->TryGetStringField(TEXT("viseme"), Viseme) || !CortanaReceiver::Visemes.Contains(Viseme))
    {
        OutError = TEXT("unknown state, emotion, or viseme");
        return false;
    }

    double AudioLevel = 0.0;
    if (!CortanaReceiver::ReadFiniteNumber(Root, TEXT("audioLevel"), AudioLevel)
        || AudioLevel < 0.0 || AudioLevel > 1.0)
    {
        OutError = TEXT("audioLevel outside [0,1]");
        return false;
    }

    const TSharedPtr<FJsonObject>* BlendshapesObject = nullptr;
    if (!Root->TryGetObjectField(TEXT("blendshapes"), BlendshapesObject) || BlendshapesObject == nullptr || !BlendshapesObject->IsValid())
    {
        OutError = TEXT("missing blendshapes object");
        return false;
    }

    FCortanaAvatarFrame Frame;
    Frame.Sequence = static_cast<int64>(Sequence);
    Frame.TimestampMs = TimestampMs;
    Frame.State = State;
    Frame.Emotion = Emotion;
    Frame.Viseme = Viseme;
    Frame.AudioLevel = static_cast<float>(AudioLevel);

    for (const FName Channel : CortanaReceiver::Channels)
    {
        double Value = 0.0;
        if (!CortanaReceiver::ReadFiniteNumber(*BlendshapesObject, *Channel.ToString(), Value)
            || Value < 0.0 || Value > 1.0)
        {
            OutError = FString::Printf(TEXT("invalid blendshape channel: %s"), *Channel.ToString());
            return false;
        }
        Frame.Blendshapes.Add(Channel, static_cast<float>(Value));
    }

    OutFrame = MoveTemp(Frame);
    return true;
}

void UCortanaAvatarReceiverComponent::ApplyValidatedFrame(const FCortanaAvatarFrame& Frame)
{
    if (Frame.Sequence <= LastAcceptedSequence)
    {
        return;
    }

    LastAcceptedSequence = Frame.Sequence;
    LastFrameArrivalSeconds = FPlatformTime::Seconds();
    bHasFrame = true;
    CurrentFrame = Frame;
    OnFrameReceived.Broadcast(CurrentFrame);
}

void UCortanaAvatarReceiverComponent::ResetFrameAfterTimeout()
{
    if (!bHasFrame)
    {
        return;
    }

    bHasFrame = false;
    LastAcceptedSequence = 0;
    CurrentFrame.ResetToNeutral();
    OnFrameReceived.Broadcast(CurrentFrame);
}
