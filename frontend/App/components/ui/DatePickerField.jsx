import React, { useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../constants/theme/ThemeContext';
import { Spacing } from '../../constants/theme';
import AppText from './AppText';
import AppButton from './AppButton';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export default function DatePickerField({ label, value, onChange, style, minDate }) {
  const { colors, typography } = useTheme();
  const [visible, setVisible] = useState(false);

  const today = new Date();
  const parsed = value ? new Date(value) : today;
  const [day, setDay]     = useState(parsed.getDate());
  const [month, setMonth] = useState(parsed.getMonth() + 1); // 1-12
  const [year, setYear]   = useState(parsed.getFullYear());

  const minYear = (minDate ? new Date(minDate) : today).getFullYear();
  const maxDay  = daysInMonth(month, year);

  const adjDay = clamp(day, 1, maxDay);

  const handleConfirm = () => {
    const d = clamp(day, 1, maxDay);
    const formatted = `${year}-${pad(month)}-${pad(d)}`;
    onChange(formatted);
    setVisible(false);
  };

  const handleOpen = () => {
    if (value) {
      const p = new Date(value);
      setDay(p.getDate());
      setMonth(p.getMonth() + 1);
      setYear(p.getFullYear());
    }
    setVisible(true);
  };

  const display = value
    ? (() => {
        const d = new Date(value);
        return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      })()
    : 'Tap to select date';

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
        <MaterialIcons name="calendar-today" size={18} color={colors.onSurfaceVariant} style={{ marginRight: 8 }} />
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
              Select Date
            </AppText>

            <View style={styles.columns}>
              {/* Day */}
              <SpinColumn
                label="Day"
                value={adjDay}
                min={1}
                max={maxDay}
                onChange={(v) => setDay(v)}
                colors={colors}
                typography={typography}
              />
              {/* Month */}
              <SpinColumn
                label="Month"
                value={month}
                min={1}
                max={12}
                onChange={(v) => setMonth(v)}
                display={(v) => MONTHS[v - 1].slice(0, 3)}
                colors={colors}
                typography={typography}
              />
              {/* Year */}
              <SpinColumn
                label="Year"
                value={year}
                min={minYear}
                max={minYear + 2}
                onChange={(v) => setYear(v)}
                colors={colors}
                typography={typography}
              />
            </View>

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

function SpinColumn({ label, value, min, max, onChange, display, colors, typography }) {
  const decrement = () => onChange(value <= min ? max : value - 1);
  const increment = () => onChange(value >= max ? min : value + 1);
  const shown = display ? display(value) : String(value);

  return (
    <View style={spinStyles.col}>
      <AppText style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginBottom: 4, textAlign: 'center' }]}>
        {label}
      </AppText>
      <TouchableOpacity onPress={increment} style={spinStyles.btn} accessibilityRole="button">
        <MaterialIcons name="keyboard-arrow-up" size={28} color={colors.primary} />
      </TouchableOpacity>
      <View style={[spinStyles.valueBadge, { backgroundColor: colors.primaryContainer }]}>
        <AppText variant="titleMedium" style={{ color: colors.onPrimaryContainer, textAlign: 'center', fontWeight: '700', minWidth: 48 }}>
          {shown}
        </AppText>
      </View>
      <TouchableOpacity onPress={decrement} style={spinStyles.btn} accessibilityRole="button">
        <MaterialIcons name="keyboard-arrow-down" size={28} color={colors.primary} />
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
  columns: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

const spinStyles = StyleSheet.create({
  col: { alignItems: 'center', minWidth: 72 },
  btn: { padding: 4 },
  valueBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginVertical: 4,
    minWidth: 56,
    alignItems: 'center',
  },
});
