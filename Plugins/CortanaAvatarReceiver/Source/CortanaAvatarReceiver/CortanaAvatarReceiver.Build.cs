using UnrealBuildTool;

public class CortanaAvatarReceiver : ModuleRules
{
    public CortanaAvatarReceiver(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "WebSockets",
            "Json"
        });
    }
}
