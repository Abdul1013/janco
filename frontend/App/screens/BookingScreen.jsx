import React, { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import Checkbox from 'expo-checkbox';
import { useTheme } from '../constants/theme/ThemeContext';
import { useAuth } from '../hooks/authContext';
import { getAvailableServices, getServiceById } from '../constants/services';
import ScreenWrapper from '../components/ui/ScreenWrapper';
import AppCard from '../components/ui/AppCard';
import AppInput from '../components/ui/AppInput';
import AppButton from '../components/ui/AppButton';
import AppText from '../components/ui/AppText';
import DatePickerField from '../components/ui/DatePickerField';
import TimePickerField from '../components/ui/TimePickerField';
import useUserLocation from '../hooks/useUserLocation';

const IconMap = { MaterialIcons, MaterialCommunityIcons };
const STEPS = ['Service', 'Details', 'Schedule', 'Review'];
const ENTRY_MODES = [
  { key: 'normal', label: 'Manual Entry', icon: 'edit' },
  { key: 'scan', label: 'Scan Room', icon: 'camera-alt' },
];

// const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

export default function BookingScreen({ route }) {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const { address: gpsAddress, coords, errorMsg: locationError } = useUserLocation(profile);

  const [step, setStep]             = useState(0);
  const [category, setCategory]     = useState(route?.params?.serviceType || null);
  const [entryMode, setEntryMode]   = useState(route?.params?.scanResult ? 'scan' : 'normal');
  const [scanResult, setScanResult] = useState(route?.params?.scanResult || null);

  // Pick up scan results when returning from RoomScanScreen
  useEffect(() => {
    if (route?.params?.scanResult && route.params.scanResult !== scanResult) {
      setScanResult(route.params.scanResult);
      setEntryMode('scan');
    }
  }, [route?.params?.scanResult]);

  // Auto-fill address from GPS when it resolves (only if user hasn't typed anything)
  useEffect(() => {
    if (gpsAddress && !address) {
      setAddress(gpsAddress);
    }
  }, [gpsAddress]);

  // Cleaning details
  const [bedrooms, setBedrooms]     = useState('');
  const [sittingRooms, setSitting]  = useState('');
  const [toilets, setToilets]       = useState('');
  const [kitchens, setKitchens]     = useState('');
  const [extras, setExtras]         = useState({
    windowCleaning: false,
    ceilingFan: false,
    stoveCleaning: false,
    carpetCleaning: false,
    refrigerator: false,
  });

  // Laundry details
  const [clothesCount, setClothes]  = useState('');
  const [ironingOnly, setIroning]   = useState(false);

  // Schedule
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const [date, setDate]             = useState('');
  const [time, setTime]             = useState('');
  const [address, setAddress]       = useState(profile?.address || gpsAddress || '');
  const [state, setState_]          = useState('');
  const [notes, setNotes]           = useState('');
  const [submitting]                = useState(false);

  const canNext = () => {
    if (step === 0) return !!category;
    if (step === 1) return true;
    if (step === 2) return !!date && !!time && address.trim().length > 3;
    return true;
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleSubmit();
  };

  const handleSubmit = () => {
    navigation.navigate('PriceEstimate', {
      category,
      bedrooms: parseInt(bedrooms || '0', 10),
      sittingRooms: parseInt(sittingRooms || '0', 10),
      toilets: parseInt(toilets || '0', 10),
      kitchens: parseInt(kitchens || '0', 10),
      clothesCount: parseInt(clothesCount || '0', 10),
      ironingOnly,
      extras,
      date,
      time,
      notes,
      address,
      userLocation: { lat: coords?.lat || 0, lng: coords?.lng || 0 },
      scanResult: entryMode === 'scan' ? scanResult : null,
    });
  };

  // ── Step indicator 
  const StepIndicator = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg }}>
      {STEPS.map((label, i) => (
        <View key={label} style={{ alignItems: 'center', marginHorizontal: spacing.sm }}>
          <View
            style={{
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: i < step ? colors.secondary : i === step ? colors.primary : colors.surfaceVariant,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {i < step
              ? <MaterialIcons name="check" size={16} color={colors.onSecondary ?? colors.onPrimary} />
              : <AppText variant="bodySmall" style={{ color: i === step ? colors.onPrimary : colors.onSurfaceVariant, fontWeight: '700' }}>{i + 1}</AppText>
            }
          </View>
          <AppText variant="bodySmall" style={{ color: i === step ? colors.primary : colors.onSurfaceVariant, marginTop: 2, fontWeight: i === step ? '600' : '400' }}>
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );

  const toggleExtra = (key) => setExtras((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Render 
  const svc = getServiceById(category);

  return (
    <ScreenWrapper
      avoidKeyboard
      title="Book a Service"
      showBack
      showNav
      activeTab="Book"
    >
      <StepIndicator />

      {/* ── Step 0: Choose service ── */}
      {step === 0 && (
        <>
          <AppText variant="titleMedium" style={{ color: colors.onBackground, marginBottom: spacing.md }}>
            What service do you need?
          </AppText>
          {getAvailableServices().map((s) => {
            const Comp = IconMap[s.iconFamily] || MaterialIcons;
            const selected = category === s.id;
            return (
              <AppCard
                key={s.id}
                elevation={selected ? 2 : 1}
                onPress={() => setCategory(s.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm,
                  borderWidth: selected ? 2 : 0, borderColor: selected ? colors.primary : 'transparent',
                }}
              >
                <Comp name={s.icon} size={28} color={selected ? colors.primary : colors.onSurfaceVariant} />
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ color: colors.onSurface, fontWeight: '600' }}>{s.label}</AppText>
                  <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{s.description}</AppText>
                </View>
                {selected && <MaterialIcons name="check-circle" size={24} color={colors.primary} />}
              </AppCard>
            );
          })}
        </>
      )}

      {/* ── Step 1: Service details ── */}
      {step === 1 && (
        <>
          {/* Mode toggle — only for cleaning services (not laundry/fumigation) */}
          {(category === 'house_cleaning' || category === 'deep_cleaning') && (
            <>
              <View style={{ flexDirection: 'row', marginBottom: spacing.md, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.outline }}>
                {ENTRY_MODES.map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => setEntryMode(m.key)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 12,
                      backgroundColor: entryMode === m.key ? colors.primary : 'transparent',
                      gap: 6,
                    }}
                  >
                    <MaterialIcons
                      name={m.icon}
                      size={18}
                      color={entryMode === m.key ? colors.onPrimary : colors.onSurfaceVariant}
                    />
                    <AppText
                      variant="bodySmall"
                      style={{
                        color: entryMode === m.key ? colors.onPrimary : colors.onSurfaceVariant,
                        fontWeight: entryMode === m.key ? '700' : '400',
                      }}
                    >
                      {m.label}
                    </AppText>
                  </Pressable>
                ))}
              </View>

              {/* Scan mode: show scan button or scan result summary */}
              {entryMode === 'scan' && (
                <>
                  {scanResult ? (
                    <AppCard elevation={1} style={{ marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.primary }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                        <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                        <AppText variant="bodyMedium" style={{ color: colors.primary, fontWeight: '600', marginLeft: spacing.xs }}>
                          Room Scanned
                        </AppText>
                      </View>
                      <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                        Area: {scanResult.estimated_area} m² ({scanResult.room_size})
                      </AppText>
                      <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                        Clutter: {scanResult.clutter_level} | Modifier: x{scanResult.price_modifier}
                      </AppText>
                      <AppButton
                        title="Rescan Room"
                        variant="text"
                        onPress={() => {
                          setScanResult(null);
                          navigation.navigate('RoomScan', {
                            category,
                            bedrooms: parseInt(bedrooms || '0', 10),
                            sittingRooms: parseInt(sittingRooms || '0', 10),
                            toilets: parseInt(toilets || '0', 10),
                            kitchens: parseInt(kitchens || '0', 10),
                            extras,
                          });
                        }}
                        style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
                      />
                    </AppCard>
                  ) : (
                    <AppCard
                      elevation={1}
                      onPress={() =>
                        navigation.navigate('RoomScan', {
                          category,
                          bedrooms: parseInt(bedrooms || '0', 10),
                          sittingRooms: parseInt(sittingRooms || '0', 10),
                          toilets: parseInt(toilets || '0', 10),
                          kitchens: parseInt(kitchens || '0', 10),
                          extras,
                        })
                      }
                      style={{
                        alignItems: 'center',
                        paddingVertical: spacing.xl,
                        marginBottom: spacing.md,
                        borderWidth: 1,
                        borderColor: colors.primary,
                        borderStyle: 'dashed',
                      }}
                    >
                      <MaterialIcons name="camera-alt" size={40} color={colors.primary} />
                      <AppText variant="titleSmall" style={{ color: colors.primary, marginTop: spacing.sm }}>
                        Tap to Scan Room
                      </AppText>
                      <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.xs }}>
                        Use your camera to estimate room size and clutter for accurate pricing.
                      </AppText>
                    </AppCard>
                  )}
                </>
              )}
            </>
          )}

          {category === 'laundry' ? (
            <>
              <AppText variant="titleMedium" style={{ color: colors.onBackground, marginBottom: spacing.md }}>Laundry Details</AppText>
              <AppInput
                label="Number of clothing items"
                value={clothesCount}
                onChangeText={setClothes}
                inputProps={{ keyboardType: 'numeric', placeholder: 'e.g. 20' }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                <Checkbox
                  value={ironingOnly}
                  onValueChange={setIroning}
                  color={ironingOnly ? colors.primary : undefined}
                />
                <AppText variant="bodyMedium" style={{ color: colors.onSurface, marginLeft: spacing.sm }}>
                  Ironing only (no washing)
                </AppText>
              </View>
              <AppCard elevation={0} style={{ backgroundColor: colors.surfaceVariant, marginBottom: spacing.md }}>
                <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                  💡 Pricing is per item. Bedsheets, duvet covers and trousers count as 2 items each.
                </AppText>
              </AppCard>
            </>
          ) : (
            <>
              <AppText variant="titleMedium" style={{ color: colors.onBackground, marginBottom: spacing.md }}>
                {category === 'deep_cleaning' ? 'Deep Cleaning Details' : 'Cleaning Details'}
              </AppText>

              <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.sm }}>
                Enter 0 for rooms that don't apply.
              </AppText>

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <AppInput label="Bedrooms" value={bedrooms} onChangeText={setBedrooms} inputProps={{ keyboardType: 'numeric', placeholder: '0' }} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppInput label="Sitting Rooms" value={sittingRooms} onChangeText={setSitting} inputProps={{ keyboardType: 'numeric', placeholder: '0' }} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <AppInput label="Toilets / Bathrooms" value={toilets} onChangeText={setToilets} inputProps={{ keyboardType: 'numeric', placeholder: '0' }} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppInput label="Kitchens" value={kitchens} onChangeText={setKitchens} inputProps={{ keyboardType: 'numeric', placeholder: '0' }} />
                </View>
              </View>

              <AppText variant="bodyMedium" style={{ color: colors.onSurface, marginBottom: spacing.sm, marginTop: spacing.xs }}>
                Add-ons (extra charge applies)
              </AppText>
              {[
                { key: 'windowCleaning', label: 'Window Cleaning' },
                { key: 'ceilingFan',     label: 'Ceiling Fan Cleaning' },
                { key: 'stoveCleaning',  label: 'Stove / Cooker Deep Clean' },
                { key: 'carpetCleaning', label: 'Carpet / Rug Cleaning' },
                { key: 'refrigerator',   label: 'Refrigerator Cleaning' },
              ].map(({ key, label }) => (
                <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                  <Checkbox
                    value={extras[key]}
                    onValueChange={() => toggleExtra(key)}
                    color={extras[key] ? colors.primary : undefined}
                  />
                  <AppText variant="bodyMedium" style={{ color: colors.onSurface, marginLeft: spacing.sm }}>
                    {label}
                  </AppText>
                </View>
              ))}
            </>
          )}
        </>
      )}

      {/* ── Step 2: Schedule ── */}
      {step === 2 && (
        <>
          <AppText variant="titleMedium" style={{ color: colors.onBackground, marginBottom: spacing.md }}>
            When &amp; Where?
          </AppText>

          <DatePickerField
            label="Preferred Date"
            value={date}
            onChange={setDate}
            minDate={minDate}
          />
          <TimePickerField
            label="Preferred Time"
            value={time}
            onChange={setTime}
          />

          <AppInput
            label="Full Address"
            value={address}
            onChangeText={setAddress}
            inputProps={{ placeholder: 'e.g. 14 Afolabi Close, Ikeja' }}
          />
          {coords?.lat ? (
            <AppText variant="bodySmall" style={{ color: colors.primary, marginTop: -spacing.xs, marginBottom: spacing.sm }}>
               GPS location detected ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
            </AppText>
          ) : locationError ? (
            <AppText variant="bodySmall" style={{ color: colors.error, marginTop: -spacing.xs, marginBottom: spacing.sm }}>
              ⚠ Location not available — janitor matching may be less accurate.
            </AppText>
          ) : null}

          <AppCard elevation={0} style={{ backgroundColor: colors.surfaceVariant }}>
            <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
               Our janitors currently serve Lagos, Abuja, Port Harcourt, Ibadan, Kano and Enugu. More cities coming soon.
            </AppText>
          </AppCard>
        </>
      )}

      {/* ── Step 3: Review ── */}
      {step === 3 && (
        <>
          <AppText variant="titleMedium" style={{ color: colors.onBackground, marginBottom: spacing.md }}>
            Review Your Booking
          </AppText>
          <AppCard elevation={1} style={{ marginBottom: spacing.md }}>
            <Row label="Service"   value={svc?.label || category} colors={colors} spacing={spacing} />
            {(category === 'house_cleaning' || category === 'deep_cleaning') && (
              <>
                {bedrooms     ? <Row label="Bedrooms"         value={bedrooms}     colors={colors} spacing={spacing} /> : null}
                {sittingRooms ? <Row label="Sitting Rooms"    value={sittingRooms} colors={colors} spacing={spacing} /> : null}
                {toilets      ? <Row label="Toilets"          value={toilets}      colors={colors} spacing={spacing} /> : null}
                {kitchens     ? <Row label="Kitchens"         value={kitchens}     colors={colors} spacing={spacing} /> : null}
              </>
            )}
            {category === 'laundry' && (
              <>
                <Row label="Items"        value={clothesCount}              colors={colors} spacing={spacing} />
                <Row label="Service type" value={ironingOnly ? 'Iron only' : 'Wash + Iron'} colors={colors} spacing={spacing} />
              </>
            )}
            {Object.entries(extras).filter(([, v]) => v).length > 0 && (
              <Row
                label="Add-ons"
                value={Object.entries(extras).filter(([, v]) => v).map(([k]) =>
                  k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
                ).join(', ')}
                colors={colors}
                spacing={spacing}
              />
            )}
            {scanResult && (
              <>
                <View style={{ height: 1, backgroundColor: colors.outlineVariant, marginVertical: spacing.xs }} />
                <Row label="Room Scan"     value={`${scanResult.estimated_area} m² (${scanResult.room_size})`} colors={colors} spacing={spacing} />
                <Row label="Clutter"       value={scanResult.clutter_level} colors={colors} spacing={spacing} />
                <Row label="Price Modifier" value={`x${scanResult.price_modifier}`} colors={colors} spacing={spacing} />
              </>
            )}
            <View style={{ height: 1, backgroundColor: colors.outlineVariant, marginVertical: spacing.xs }} />
            <Row label="Date"    value={date ? new Date(date).toDateString() : '—'} colors={colors} spacing={spacing} />
            <Row label="Time"    value={time || '—'}    colors={colors} spacing={spacing} />
            <Row label="Address" value={`${address}${state ? `, ${state}` : ''}`} colors={colors} spacing={spacing} />
            {notes ? <Row label="Directions" value={notes} colors={colors} spacing={spacing} /> : null}
          </AppCard>

          <AppCard elevation={0} style={{ backgroundColor: colors.tertiaryContainer ?? colors.surfaceVariant }}>
            <AppText variant="bodySmall" style={{ color: colors.onTertiaryContainer ?? colors.onSurface }}>
             A price estimate will be calculated next. Payment is only collected after you confirm a janitor.
            </AppText>
          </AppCard>
        </>
      )}

      {/* ── Nav buttons ── */}
      <View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm }}>
        {step > 0 && (
          <AppButton
            title="Back"
            variant="outlined"
            onPress={() => setStep(step - 1)}
            style={{ flex: 1 }}
          />
        )}
        <AppButton
          title={step === 3 ? 'Get Price Estimate' : 'Continue'}
          onPress={handleNext}
          disabled={!canNext()}
          loading={submitting}
          style={{ flex: 1 }}
        />
      </View>
    </ScreenWrapper>
  );
}

function Row({ label, value, colors, spacing }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
      <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>{label}</AppText>
      <AppText variant="bodyMedium" style={{ color: colors.onSurface, fontWeight: '500', maxWidth: '60%', textAlign: 'right' }}>
        {value}
      </AppText>
    </View>
  );
}
