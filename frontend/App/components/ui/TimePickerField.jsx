import React, { useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../constants/theme/ThemeContext';
import { Spacing } from '../../constants/theme';
import AppText from './AppText';
import AppButton from './AppButton';

function pad(n) {
  return String(n).padStart(2, '0');
}

const MINUTE_STEPS = [0, 15, 30, 45];

export default function TimePickerField({ label, value, onChange, style }) {
  const { colors, typography } = useTheme();
  const [visible, setVisible] = useState(false);

  const parseValue = (v) => {
    if (!v) return { hour: 8, minute: 0, ampm: 'AM' };
    const [timePart, ampmPart] = v.split(' ');
    const [h, m] = timePart.split(':').map(Number);
    return { hour: h, minute: m, ampm: ampmPart || 'AM' };
  };

  const init = parseValue(value);
  const [hour, setHour]     = useState(init.hour);
  const [minute, setMinute] = useState(init.minute);
  const [ampm, setAmpm]     = useState(init.ampm);

  const handleOpen = () => {
    const p = parseValue(value);
    setHour(p.hour);
    setMinute(p.minute);
    setAmpm(p.ampm);
    setVisible(true);
  };

  const handleConfirm = () => {
    onChange(`${pad(hour)}:${pad(minute)} ${ampm}`);
    setVisible(false);
  };

  const cycleMins = (dir) => {
    const idx = MINUTE_STEPS.indexOf(minute);
    const next = (idx + dir + MINUTE_STEPS.length) % MINUTE_STEPS.length;
    setMinute(MINUTE_STEPS[next]);
  };

  const cycleHour = (dir) => {
    setHour((h) => {
      const next = h + dir;
      if (next < 1) return 12;
      if (next > 12) return 1;
      return next;
    });
  };

  const display = value || 'Tap to select time';
  const hasValue = !!value;

  return (
    <View style={[styles.wrapper, style]}>
      <AppText style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginBottom: Spacing.xs }]}>
        {label}
      </AppText>

      <TouchableOpacity
        onPress={handleOpen}
        style={[styles.field, { borderColor: colors.outline, backgroundColor: colors.surface }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display}`}
      >
        <MaterialIcons name="access-time" size={18} color={colors.onSurfaceVariant} style={{ marginRight: 8 }} />
        <AppText
          variant="bodyLarge"
          style={{ flex: 1, color: hasValue ? colors.onSurface : colors.onSurfaceVariant }}
        >
          {display}
        </AppText>
        <MaterialIcons name="expand-more" size={20} color={colors.onSurfaceVariant} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setVisible(false)} />
        <View style={styles.sheetOuter}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <AppText variant="titleMedium" style={{ color: colors.onSurface, textAlign: 'center', marginBottom: Spacing.lg }}>
              Select Time
            </AppText>

            <View style={styles.timeRow}>
              {/* Hour */}
              <SpinCol
                value={pad(hour)}
                onUp={() => cycleHour(1)}
                onDown={() => cycleHour(-1)}
                colors={colors}
              />

              <AppText variant="headlineMedium" style={{ color: colors.onSurface, marginHorizontal: 8, alignSelf: 'center' }}>:</AppText>

              {/* Minute */}
              <SpinCol
                value={pad(minute)}
                onUp={() => cycleMins(1)}
                onDown={() => cycleMins(-1)}
                colors={colors}
              />

              {/* AM/PM */}
              <View style={{ marginLeft: 16, justifyContent: 'center' }}>
                <TouchableOpacity
                  onPress={() => setAmpm('AM')}
                  style={[styles.ampmBtn, { backgroundColor: ampm === 'AM' ? colors.primaryContainer : colors.surfaceVariant }]}
                >
                  <AppText variant="bodyMedium" style={{ color: ampm === 'AM' ? colors.onPrimaryContainer : colors.onSurfaceVariant, fontWeight: '700' }}>
                    AM
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAmpm('PM')}
                  style={[styles.ampmBtn, { backgroundColor: ampm === 'PM' ? colors.primaryContainer : colors.surfaceVariant, marginTop: 8 }]}
                >
                  <AppText variant="bodyMedium" style={{ color: ampm === 'PM' ? colors.onPrimaryContainer : colors.onSurfaceVariant, fontWeight: '700' }}>
                    PM
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>

            <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: Spacing.md }}>
              Minutes snap to 00 · 15 · 30 · 45
            </AppText>

            <View style={[styles.actions, { borderTopColor: colors.outlineVariant }]}>
              <AppButton title="Cancel" variant="outlined" onPress={() => setVisible(false)} style={{ flex: 1, marginRight: 8 }} />
              <AppButton title="Confirm" onPress={handleConfirm} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SpinCol({ value, onUp, onDown, colors }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <TouchableOpacity onPress={onUp} style={{ padding: 4 }} accessibilityRole="button">
        <MaterialIcons name="keyboard-arrow-up" size={32} color={colors.primary} />
      </TouchableOpacity>
      <View style={[spinStyles.badge, { backgroundColor: colors.primaryContainer }]}>
        <AppText variant="headlineMedium" style={{ color: colors.onPrimaryContainer, fontWeight: '700', textAlign: 'center', minWidth: 52 }}>
          {value}
        </AppText>
      </View>
      <TouchableOpacity onPress={onDown} style={{ padding: 4 }} accessibilityRole="button">
        <MaterialIcons name="keyboard-arrow-down" size={32} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.base },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetOuter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  ampmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

const spinStyles = StyleSheet.create({
  badge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginVertical: 4,
    alignItems: 'center',
  },
});
