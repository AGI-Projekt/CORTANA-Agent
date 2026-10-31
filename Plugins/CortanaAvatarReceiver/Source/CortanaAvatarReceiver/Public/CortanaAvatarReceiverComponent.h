#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "IWebSocket.h"
#include "CortanaAvatarReceiverComponent.generated.h"

USTRUCT(BlueprintType)
struct CORTANAAVATARRECEIVER_API FCortanaAvatarFrame
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category="Cortana|Avatar")
    int64 Sequence = 0;

    UPROPERTY(BlueprintReadOnly, Category="Cortana|Avatar")
    double TimestampMs = 0.0;

    UPROPERTY(BlueprintReadOnly, Category="Cortana|Avatar")
    FString State = TEXT("idle");

    UPROPERTY(BlueprintReadOnly, Category="Cortana|Avatar")
    FString Emotion = TEXT("calm");

    UPROPERTY(BlueprintReadOnly, Category="Cortana|Avatar")
    FString Viseme = TEXT("neutral");

    UPROPERTY(BlueprintReadOnly, Category="Cortana|Avatar")
    float AudioLevel = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category="Cortana|Avatar")
    TMap<FName, float> Blendshapes;

    void ResetToNeutral();
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FCortanaAvatarFrameEvent, const FCortanaAvatarFrame&, Frame);

/**
 * Receives cortana.avatar.frame protocol v1.
 * Network callbacks validate JSON off-thread; Blueprint events are dispatched on Game Thread.
 */
UCLASS(ClassGroup=(Cortana), meta=(BlueprintSpawnableComponent))
class CORTANAAVATARRECEIVER_API UCortanaAvatarReceiverComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UCortanaAvatarReceiverComponent();

    UPROPERTY(BlueprintAssignable, Category="Cortana|Avatar")
    FCortanaAvatarFrameEvent OnFrameReceived;

    UPROPERTY(BlueprintReadOnly, Category="Cortana|Avatar")
    FCortanaAvatarFrame CurrentFrame;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Cortana|Avatar", meta=(ClampMin="0.1", ClampMax="10.0"))
    float FrameTimeoutSeconds = 0.5f;

    UFUNCTION(BlueprintCallable, Category="Cortana|Avatar")
    bool ConnectToEndpoint(const FString& Url);

    UFUNCTION(BlueprintCallable, Category="Cortana|Avatar")
    void DisconnectFromEndpoint();

    UFUNCTION(BlueprintPure, Category="Cortana|Avatar")
    bool IsConnected() const;

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
    TSharedPtr<IWebSocket> Socket;
    int64 LastAcceptedSequence = 0;
    double LastFrameArrivalSeconds = 0.0;
    bool bHasFrame = false;

    static bool ValidateAndParseMessage(const FString& Message, FCortanaAvatarFrame& OutFrame, FString& OutError);
    void ApplyValidatedFrame(const FCortanaAvatarFrame& Frame);
    void ResetFrameAfterTimeout();
};
