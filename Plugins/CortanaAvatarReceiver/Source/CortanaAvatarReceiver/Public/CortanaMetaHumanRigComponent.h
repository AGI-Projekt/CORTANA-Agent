#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "CortanaAvatarReceiverComponent.h"
#include "CortanaMetaHumanMappingAsset.h"
#include "CortanaMetaHumanRigComponent.generated.h"

class USkeletalMeshComponent;

USTRUCT(BlueprintType)
struct CORTANAAVATARRECEIVER_API FCortanaRigAnimationState
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly, Category="Cortana|Rig") TMap<FName, float> FacialChannels;
    UPROPERTY(BlueprintReadOnly, Category="Cortana|Rig") FString Emotion = TEXT("calm");
    UPROPERTY(BlueprintReadOnly, Category="Cortana|Rig") FString Viseme = TEXT("neutral");
    UPROPERTY(BlueprintReadOnly, Category="Cortana|Rig") FString State = TEXT("idle");
    UPROPERTY(BlueprintReadOnly, Category="Cortana|Rig") float AudioLevel = 0.0f;
};
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FCortanaRigAnimationStateEvent, const FCortanaRigAnimationState&, AnimationState);

UCLASS(ClassGroup=(Cortana), meta=(BlueprintSpawnableComponent))
class CORTANAAVATARRECEIVER_API UCortanaMetaHumanRigComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UCortanaMetaHumanRigComponent();
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Cortana|Rig") TObjectPtr<UCortanaAvatarReceiverComponent> Receiver = nullptr;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Cortana|Rig") TObjectPtr<USkeletalMeshComponent> TargetMesh = nullptr;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Cortana|Rig") TObjectPtr<UCortanaMetaHumanMappingAsset> Mapping = nullptr;
    UPROPERTY(BlueprintAssignable, Category="Cortana|Rig") FCortanaRigAnimationStateEvent OnAnimationStateUpdated;
    UPROPERTY(BlueprintReadOnly, Category="Cortana|Rig") FCortanaRigAnimationState CurrentAnimationState;

    UFUNCTION(BlueprintCallable, Category="Cortana|Rig") void BindReceiver();
    UFUNCTION(BlueprintCallable, Category="Cortana|Rig") void UnbindReceiver();
    UFUNCTION(BlueprintCallable, Category="Cortana|Rig") void ApplyNeutralPose();
protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
private:
    TMap<FName, float> TargetValues;
    TMap<FName, float> SmoothedValues;
    bool bHasReceivedFrame = false;
    UFUNCTION() void HandleAvatarFrame(const FCortanaAvatarFrame& Frame);
    void BuildTargetsFromFrame(const FCortanaAvatarFrame& Frame);
    void PublishAnimationState();
};
