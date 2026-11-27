package longhaul.runtime.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Pseudo;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Prevents Distant Horizons 3.3.x from crashing chunk promotion/loading with
 * "IllegalStateException: Chunky is not loaded." when chunks load before
 * ServerStartingEvent (during world creation / spawn prep or on multiplayer clients).
 * Cancels at HEAD before DH sets listenerBound=true so DH retries once Chunky is ready.
 */
@Pseudo
@Mixin(targets = "com.seibel.distanthorizons.core.wrapperInterfaces.modAccessor.AbstractChunkyAccessor", remap = false)
public abstract class DhChunkyAccessorMixin {
    @Inject(method = "tryRunFirstTimeSetup", at = @At("HEAD"), cancellable = true, require = 0)
    private void longhaul$deferUntilChunkyLoaded(CallbackInfo ci) {
        try {
            Class<?> cp = Class.forName("org.popcraft.chunky.ChunkyProvider", false, ((Object) this).getClass().getClassLoader());
            Object chunky = cp.getMethod("get").invoke(null);
            if (chunky == null) {
                ci.cancel();
            }
        } catch (Throwable ignored) {
            ci.cancel();
        }
    }
}
