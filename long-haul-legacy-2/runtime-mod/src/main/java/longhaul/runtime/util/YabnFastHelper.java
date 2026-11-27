package longhaul.runtime.util;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Linear-time O(N) YABN binary serializer replacement.
 * YABN 1.0.3's YabnObject/YabnArray.toData() repeatedly calls ByteArrayUtils.add(),
 * copying the entire growing byte[] on every entry (O(N^2) allocations — >11 GB of
 * garbage when syncing 4,700+ Heracles quests on player join).
 */
public final class YabnFastHelper {
    private static volatile boolean initialized = false;
    private static volatile boolean failed = false;
    private static Method getTypeMethod;
    private static Method toDataMethod;
    private static Field typeIdField;
    private static Field typeHasDataField;

    private YabnFastHelper() {}

    private static boolean ensureInit(ClassLoader cl) {
        if (initialized) return true;
        if (failed) return false;
        synchronized (YabnFastHelper.class) {
            if (initialized) return true;
            if (failed) return false;
            try {
                Class<?> elemCls = Class.forName("com.teamresourceful.yabn.elements.YabnElement", false, cl);
                Class<?> typeCls = Class.forName("com.teamresourceful.yabn.elements.YabnType", false, cl);
                getTypeMethod = elemCls.getMethod("getType");
                toDataMethod = elemCls.getMethod("toData");
                typeIdField = typeCls.getField("id");
                typeHasDataField = typeCls.getField("hasData");
                initialized = true;
                return true;
            } catch (Throwable t) {
                failed = true;
                return false;
            }
        }
    }

    public static byte[] encodeObject(Object self, Map<?, ?> elements) {
        if (elements == null) return null;
        if (elements.isEmpty()) return new byte[0];
        if (!ensureInit(self.getClass().getClassLoader())) return null;
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream(Math.max(64, elements.size() * 64));
            for (Map.Entry<?, ?> entry : elements.entrySet()) {
                Object element = entry.getValue();
                Object type = getTypeMethod.invoke(element);
                byte typeId = typeIdField.getByte(type);
                out.write(typeId & 0xFF);
                byte[] keyBytes = String.valueOf(entry.getKey()).getBytes(StandardCharsets.UTF_8);
                out.write(keyBytes, 0, keyBytes.length);
                out.write(0); // YabnElement.EOD
                byte[] valBytes = (byte[]) toDataMethod.invoke(element);
                out.write(valBytes, 0, valBytes.length);
            }
            out.write(0); // YabnElement.EOD
            return out.toByteArray();
        } catch (Throwable t) {
            return null;
        }
    }

    public static byte[] encodeArray(Object self, List<?> elements) {
        if (elements == null) return null;
        if (elements.isEmpty()) return new byte[0];
        if (!ensureInit(self.getClass().getClassLoader())) return null;
        try {
            int n = elements.size();
            Object firstType = getTypeMethod.invoke(elements.get(0));
            boolean uniform = true;
            for (int i = 1; i < n; i++) {
                if (getTypeMethod.invoke(elements.get(i)) != firstType) {
                    uniform = false;
                    break;
                }
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream(Math.max(32, n * 16));
            if (uniform) {
                out.write(typeIdField.getByte(firstType) & 0xFF);
                writeVInt(out, n);
                if (typeHasDataField.getBoolean(firstType)) {
                    for (int i = 0; i < n; i++) {
                        byte[] b = (byte[]) toDataMethod.invoke(elements.get(i));
                        out.write(b, 0, b.length);
                    }
                }
            } else {
                for (int i = 0; i < n; i++) {
                    Object el = elements.get(i);
                    out.write(typeIdField.getByte(getTypeMethod.invoke(el)) & 0xFF);
                    byte[] b = (byte[]) toDataMethod.invoke(el);
                    out.write(b, 0, b.length);
                }
                out.write(0); // YabnElement.EOD
            }
            return out.toByteArray();
        } catch (Throwable t) {
            return null;
        }
    }

    private static void writeVInt(ByteArrayOutputStream out, int num) {
        if (num > 268435455 || num < 0) out.write(128 | (num >>> 28));
        if (num > 2097151 || num < 0) out.write(128 | ((num >>> 21) & 127));
        if (num > 16383 || num < 0) out.write(128 | ((num >>> 14) & 127));
        if (num > 127 || num < 0) out.write(128 | ((num >>> 7) & 127));
        out.write(num & 127);
    }
}
