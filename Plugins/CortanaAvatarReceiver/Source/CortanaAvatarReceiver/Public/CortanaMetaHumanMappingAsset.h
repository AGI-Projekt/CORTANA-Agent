#pragma once
#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "CortanaMetaHumanMappingAsset.generated.h"

USTRUCT(BlueprintType)
struct CORTANAAVATARRECEIVER_API FCortanaFacialChannelMapping
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Cortana|Rig") FName SourceChannel = NAME_None;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Cortana|Rig") FName MorphTargetName = NAME_None;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Cortana|Rig") bool bEnabled = true;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Cortana|Rig") float Scale = 1.0f;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Cortana|Rig") float Bias = 0.0f;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Cortana|Rig", meta=(ClampMin="0.0")) float AttackSpeed = 18.0f;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Cortana|Rig", meta=(ClampMin="0.0")) float ReleaseSpeed = 12.0f;
};

/** Per-character mapping. Populate target names from the actual rig inventory. */
UCLASS(BlueprintType)
class CORTANAAVATARRECEIVER_API UCortanaMetaHumanMappingAsset : public UDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Cortana|Rig")
    TArray<FCortanaFacialChannelMapping> Channels;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Cortana|Rig", meta=(ClampMin="0.0", ClampMax="1.0"))
    float NeutralValue = 0.0f;
};
