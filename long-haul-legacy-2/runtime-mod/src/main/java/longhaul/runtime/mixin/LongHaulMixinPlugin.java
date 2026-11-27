package longhaul.runtime.mixin;

import java.util.List;
import java.util.Set;
import net.minecraftforge.fml.loading.FMLLoader;
import org.objectweb.asm.tree.ClassNode;
import org.spongepowered.asm.mixin.extensibility.IMixinConfigPlugin;
import org.spongepowered.asm.mixin.extensibility.IMixinInfo;

/**
 * Conditionally applies client-only Xaero World Map / Minimap highlighter mixins
 * only when the corresponding Xaero mod is present in the loading mod list.
 */
public final class LongHaulMixinPlugin implements IMixinConfigPlugin {
    @Override
    public boolean shouldApplyMixin(String targetClassName, String mixinClassName) {
        if (mixinClassName.endsWith("WorldMapRegistryMixin")) {
            return hasMod("xaeroworldmap");
        }
        if (mixinClassName.endsWith("MinimapRegistryMixin")) {
            return hasMod("xaerominimap");
        }
        if (mixinClassName.endsWith("DhChunkyAccessorMixin")) {
            return hasMod("distanthorizons") && hasMod("chunky");
        }
        return true;
    }

    private static boolean hasMod(String modId) {
        try {
            return FMLLoader.getLoadingModList() != null &&
                FMLLoader.getLoadingModList().getModFileById(modId) != null;
        } catch (Throwable ignored) {
            return false;
        }
    }

    @Override
    public void onLoad(String mixinPackage) {}

    @Override
    public String getRefMapperConfig() { return null; }

    @Override
    public void acceptTargets(Set<String> myTargets, Set<String> otherTargets) {}

    @Override
    public List<String> getMixins() { return null; }

    @Override
    public void preApply(String targetClassName, ClassNode targetClass, String mixinClassName, IMixinInfo mixinInfo) {}

    @Override
    public void postApply(String targetClassName, ClassNode targetClass, String mixinClassName, IMixinInfo mixinInfo) {}
}
