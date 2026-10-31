#include "CortanaMetaHumanRigComponent.h"
#include "Components/SkeletalMeshComponent.h"

UCortanaMetaHumanRigComponent::UCortanaMetaHumanRigComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UCortanaMetaHumanRigComponent::BeginPlay()
{
    Super::BeginPlay();
    if (!TargetMesh && GetOwner())
    {
        TargetMesh = GetOwner()->FindComponentByClass<USkeletalMeshComponent>();
    }
    BindReceiver();
    ApplyNeutralPose();
}

void UCortanaMetaHumanRigComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    UnbindReceiver();
    ApplyNeutralPose();
    Super::EndPlay(EndPlayReason);
}

void UCortanaMetaHumanRigComponent::BindReceiver()
{
    if (Receiver)
    {
        Receiver->OnFrameReceived.RemoveDynamic(this, &UCortanaMetaHumanRigComponent::HandleAvatarFrame);
        Receiver->OnFrameReceived.AddDynamic(this, &UCortanaMetaHumanRigComponent::HandleAvatarFrame);
    }
}

void UCortanaMetaHumanRigComponent::UnbindReceiver()
{
    if (Receiver)
    {
        Receiver->OnFrameReceived.RemoveDynamic(this, &UCortanaMetaHumanRigComponent::HandleAvatarFrame);
    }
}

void UCortanaMetaHumanRigComponent::HandleAvatarFrame(const FCortanaAvatarFrame& Frame)
{
    BuildTargetsFromFrame(Frame);
    CurrentAnimationState.Emotion = Frame.Emotion;
    CurrentAnimationState.Viseme = Frame.Viseme;
    CurrentAnimationState.State = Frame.State;
    CurrentAnimationState.AudioLevel = Frame.AudioLevel;
    bHasReceivedFrame = true;
}

void UCortanaMetaHumanRigComponent::BuildTargetsFromFrame(const FCortanaAvatarFrame& Frame)
{
    TargetValues.Reset();
    CurrentAnimationState.FacialChannels.Reset();
    if (!Mapping) return;

    for (const FCortanaFacialChannelMapping& Rule : Mapping->Channels)
    {
        if (!Rule.bEnabled || Rule.SourceChannel.IsNone()) continue;
        const float* SourceValue = Frame.Blendshapes.Find(Rule.SourceChannel);
        const float Input = SourceValue ? *SourceValue : Mapping->NeutralValue;
        const float Mapped = FMath::Clamp(Input * Rule.Scale + Rule.Bias, 0.0f, 1.0f);
        TargetValues.Add(Rule.SourceChannel, Mapped);
        CurrentAnimationState.FacialChannels.Add(Rule.SourceChannel, Mapped);
    }
}

void UCortanaMetaHumanRigComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    if (!Mapping) return;

    bool bChanged = false;
    for (const FCortanaFacialChannelMapping& Rule : Mapping->Channels)
    {
        if (!Rule.bEnabled || Rule.SourceChannel.IsNone()) continue;
        const float Target = bHasReceivedFrame ? TargetValues.FindRef(Rule.SourceChannel) : Mapping->NeutralValue;
        float& Current = SmoothedValues.FindOrAdd(Rule.SourceChannel, Mapping->NeutralValue);
        const float Speed = Target > Current ? Rule.AttackSpeed : Rule.ReleaseSpeed;
        Current = Speed <= 0.0f ? Target : FMath::FInterpTo(Current, Target, DeltaTime, Speed);
        Current = FMath::Clamp(Current, 0.0f, 1.0f);

        if (TargetMesh && !Rule.MorphTargetName.IsNone())
        {
            TargetMesh->SetMorphTarget(Rule.MorphTargetName, Current, false);
        }
        CurrentAnimationState.FacialChannels.Add(Rule.SourceChannel, Current);
        bChanged = true;
    }
    if (bChanged) PublishAnimationState();
}

void UCortanaMetaHumanRigComponent::ApplyNeutralPose()
{
    bHasReceivedFrame = false;
    TargetValues.Reset();
    if (TargetMesh && Mapping)
    {
        for (const FCortanaFacialChannelMapping& Rule : Mapping->Channels)
        {
            if (!Rule.MorphTargetName.IsNone()) TargetMesh->SetMorphTarget(Rule.MorphTargetName, 0.0f, false);
        }
    }
    if (Mapping)
    {
        for (const FCortanaFacialChannelMapping& Rule : Mapping->Channels)
        {
            if (!Rule.SourceChannel.IsNone()) SmoothedValues.Add(Rule.SourceChannel, Mapping->NeutralValue);
        }
    }
    CurrentAnimationState = FCortanaRigAnimationState();
    PublishAnimationState();
}

void UCortanaMetaHumanRigComponent::PublishAnimationState()
{
    OnAnimationStateUpdated.Broadcast(CurrentAnimationState);
}
