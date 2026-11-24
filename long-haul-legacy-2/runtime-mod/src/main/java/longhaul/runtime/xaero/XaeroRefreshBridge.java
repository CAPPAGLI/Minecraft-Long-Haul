package longhaul.runtime.xaero;

import java.lang.reflect.Method;

/**
 * Triggers cache invalidation on Xaero's World Map and Minimap highlighters via reflection
 * so missing either mod never causes a ClassNotFoundException.
 */
public final class XaeroRefreshBridge {
    private XaeroRefreshBridge() {}

    public static void refreshAll() {
        refreshWorldMap();
        refreshMinimap();
    }

    private static void refreshWorldMap() {
        try {
            Class<?> sessCls = Class.forName("xaero.map.WorldMapSession");
            Object session = sessCls.getMethod("getCurrentSession").invoke(null);
            if (session == null) return;
            Object processor = session.getClass().getMethod("getMapProcessor").invoke(session);
            if (processor == null) return;
            Object mapWorld = processor.getClass().getMethod("getMapWorld").invoke(processor);
            if (mapWorld != null) {
                mapWorld.getClass().getMethod("clearAllCachedHighlightHashes").invoke(mapWorld);
            }
        } catch (Throwable ignored) {}
    }

    private static void refreshMinimap() {
        try {
            Object session = null;
            try {
                Class<?> hudMods = Class.forName("xaero.hud.minimap.BuiltInHudModules");
                Object minimapMod = hudMods.getField("MINIMAP").get(null);
                if (minimapMod != null) {
                    session = minimapMod.getClass().getMethod("getCurrentSession").invoke(minimapMod);
                }
            } catch (Throwable ignored) {}
            if (session == null) {
                try {
                    Class<?> legacySess = Class.forName("xaero.common.XaeroMinimapSession");
                    session = legacySess.getMethod("getCurrentSession").invoke(null);
                } catch (Throwable ignored) {}
            }
            if (session == null) return;
            Object processor = session.getClass().getMethod("getProcessor").invoke(session);
            if (processor == null) return;
            Object writer = processor.getClass().getMethod("getMinimapWriter").invoke(processor);
            if (writer == null) return;
            Object handler = writer.getClass().getMethod("getDimensionHighlightHandler").invoke(writer);
            if (handler != null) {
                Method m = handler.getClass().getMethod("requestRefresh");
                m.invoke(handler);
            }
        } catch (Throwable ignored) {}
    }
}
