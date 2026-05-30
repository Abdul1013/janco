import React, { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../constants/theme/ThemeContext';
import { useAuth } from '../../hooks/authContext';
import { SERVICE_TYPES } from '../../constants/services';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import AppInput from '../../components/ui/AppInput';
import AppButton from '../../components/ui/AppButton';
import AppText from '../../components/ui/AppText';
import AppCard from '../../components/ui/AppCard';
import * as janitorApi from '../../api/janitorApi';

const IconMap = { MaterialIcons, MaterialCommunityIcons };

const EXPERIENCE_OPTIONS = ['Less than 1 year', '1–2 years', '3–5 years', '5–10 years', '10+ years'];
const GUARANTOR_RELATIONS = ['Spouse', 'Parent', 'Sibling', 'Relative', 'Friend', 'Colleague', 'Employer'];
const STEPS = ['Personal', 'Services', 'Guarantor', 'Bank & Submit'];

// All service types (including coming-soon) so janitors declare full capability
const ALL_SERVICES = SERVICE_TYPES;

export default function JanitorRegistrationScreen({ navigation }) {
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();

  const [step, setStep] = useState(0);

  // ── Step 0: Personal / Professional ──────────────────────────────────────
  const [phone,       setPhone]     = useState(profile?.phone || '');
  const [stateOrigin, setStateOri]  = useState('');
  const [lga,         setLga]       = useState('');
  const [address,     setAddress]   = useState(profile?.address || '');
  const [experience,  setExp]       = useState('');
  const [hasEquip,    setHasEquip]  = useState(false);
  const [bio,         setBio]       = useState('');

  // ── Step 1: Services ──────────────────────────────────────────────────────
  const [selectedServices, setServices] = useState([]);

  // ── Step 2: Guarantor ─────────────────────────────────────────────────────
  const [gName,     setGName]    = useState('');
  const [gPhone,    setGPhone]   = useState('');
  const [gRelation, setGRel]     = useState('');
  const [gAddress,  setGAddr]    = useState('');
  const [gNin,      setGNin]     = useState('');

  // ── Step 3: Bank ──────────────────────────────────────────────────────────
  const [bankName,    setBankName]    = useState('');
  const [accountNo,   setAccountNo]   = useState('');
  const [accountName, setAccountName] = useState('');
  const [isAvailable, setAvailable]   = useState(true);

  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── Validation per step ───────────────────────────────────────────────────
  const canNext = () => {
    if (step === 0) return phone.trim().length >= 11 && address.trim().length > 3 && experience && bio.trim().length >= 20;
    if (step === 1) return selectedServices.length > 0;
    if (step === 2) return gName.trim().length > 2 && gPhone.trim().length >= 11 && gRelation && gAddress.trim().length > 3;
    return bankName.trim().length > 1 && accountNo.trim().length === 10 && accountName.trim().length > 2;
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleSubmit();
  };

  const toggleService = (id) => {
    setServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { error } = await janitorApi.registerJanitor({
        phone: phone.trim(),
        address: address.trim(),
        service_types: selectedServices,
        experience,
        bio: bio.trim(),
        state_of_origin: stateOrigin.trim(),
        lga: lga.trim(),
        has_own_equipment: hasEquip,
        guarantor: {
          name: gName.trim(),
          phone: gPhone.trim(),
          relationship: gRelation,
          address: gAddress.trim(),
          nin: gNin.trim() || null,
        },
        bank_details: {
          bank_name: bankName.trim(),
          account_number: accountNo.trim(),
          account_name: accountName.trim(),
        },
        is_available: isAvailable,
      });

      if (error) {
        Alert.alert('Error', typeof error === 'string' ? error : 'Submission failed. Please try again.');
        return;
      }

      Alert.alert(
        'Application Submitted! 🎉',
        'Your application is under review. Our team will verify your details within 2–3 working days. You will be notified via SMS and in-app.',
        [{ text: 'OK', onPress: () => { setSubmitted(true); navigation.navigate('JanitorStatus'); } }],
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Submitted state ───────────────────────────────────────────────────────
  if (submitted) {
    return (
      <ScreenWrapper scrollable={false} title="Application Sent" showNav activeTab="Profile">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <MaterialIcons name="check-circle" size={72} color={colors.primary} style={{ marginBottom: spacing.lg }} />
          <AppText variant="headlineMedium" style={{ color: colors.onBackground, marginBottom: spacing.md, textAlign: 'center' }}>
            Application Submitted
          </AppText>
          <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: spacing.xl }}>
            You've already applied. Check your approval status below.
          </AppText>
          <AppButton title="Check Status" onPress={() => navigation.navigate('JanitorStatus')} />
        </View>
      </ScreenWrapper>
    );
  }

  // ── Step indicator ────────────────────────────────────────────────────────
  const StepIndicator = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg }}>
      {STEPS.map((label, i) => (
        <View key={label} style={{ alignItems: 'center', flex: 1 }}>
          <View
            style={{
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: i < step ? colors.secondary ?? colors.primary : i === step ? colors.primary : colors.surfaceVariant,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            {i < step
              ? <MaterialIcons name="check" size={16} color={colors.onPrimary} />
              : <AppText variant="bodySmall" style={{ color: i === step ? colors.onPrimary : colors.onSurfaceVariant, fontWeight: '700' }}>{i + 1}</AppText>
            }
          </View>
          <AppText variant="bodySmall" style={{ color: i === step ? colors.primary : colors.onSurfaceVariant, textAlign: 'center', fontSize: 10, fontWeight: i === step ? '700' : '400' }}>
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );

  return (
    <ScreenWrapper avoidKeyboard title="Become a Janitor" showBack showNav activeTab="Profile">
      {/* Profile summary */}
      <AppCard elevation={0} style={{ backgroundColor: colors.surfaceVariant, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
        <MaterialIcons name="account-circle" size={40} color={colors.onSurfaceVariant} style={{ marginRight: spacing.md }} />
        <View>
          <AppText variant="bodyLarge" style={{ color: colors.onSurface, fontWeight: '700' }}>
            {profile?.user_name || profile?.full_name || 'Your Name'}
          </AppText>
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{profile?.email || ''}</AppText>
        </View>
      </AppCard>

      <StepIndicator />

      {/* ── Step 0: Personal Details ── */}
      {step === 0 && (
        <>
          <AppText variant="titleMedium" style={{ color: colors.onBackground, marginBottom: spacing.md }}>
            Personal Details
          </AppText>

          <AppInput
            label="Phone Number (active line)"
            value={phone}
            onChangeText={setPhone}
            inputProps={{ keyboardType: 'phone-pad', placeholder: '080XXXXXXXX' }}
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <AppInput
                label="State of Origin"
                value={stateOrigin}
                onChangeText={setStateOri}
                inputProps={{ placeholder: 'e.g. Ogun' }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label="LGA"
                value={lga}
                onChangeText={setLga}
                inputProps={{ placeholder: 'e.g. Abeokuta North' }}
              />
            </View>
          </View>

          <AppInput
            label="Current Residential Address"
            value={address}
            onChangeText={setAddress}
            inputProps={{ placeholder: 'House no, street, area, city' }}
          />

          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.xs }}>
            Years of Experience
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.base }}>
            {EXPERIENCE_OPTIONS.map((opt) => (
              <AppCard
                key={opt}
                elevation={0}
                onPress={() => setExp(opt)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: experience === opt ? colors.primary : colors.outline,
                  backgroundColor: experience === opt ? colors.primaryContainer : colors.surface,
                }}
              >
                <AppText variant="bodySmall" style={{ color: experience === opt ? colors.onPrimaryContainer : colors.onSurface }}>
                  {opt}
                </AppText>
              </AppCard>
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLarge" style={{ color: colors.onSurface }}>I have my own cleaning equipment</AppText>
              <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                Mop, bucket, broom, scrubbers, etc.
              </AppText>
            </View>
            <Switch
              value={hasEquip}
              onValueChange={setHasEquip}
              trackColor={{ false: colors.outline, true: colors.primaryContainer }}
              thumbColor={hasEquip ? colors.primary : colors.onSurfaceVariant}
            />
          </View>

          <AppInput
            label="About You (min. 20 characters)"
            value={bio}
            onChangeText={setBio}
            inputProps={{
              placeholder: 'Describe your experience, strengths, and why clients should choose you…',
              multiline: true,
              numberOfLines: 5,
            }}
            helper={`${bio.length} / 20+ chars`}
          />
        </>
      )}

      {/* ── Step 1: Services Offered ── */}
      {step === 1 && (
        <>
          <AppText variant="titleMedium" style={{ color: colors.onBackground, marginBottom: spacing.xs }}>
            Services You Offer
          </AppText>
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.md }}>
            Select all that apply. Clients will filter by these.
          </AppText>

          {ALL_SERVICES.map((svc) => {
            const Comp = IconMap[svc.iconFamily] || MaterialIcons;
            const selected = selectedServices.includes(svc.id);
            return (
              <AppCard
                key={svc.id}
                elevation={selected ? 2 : 1}
                onPress={() => toggleService(svc.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: spacing.sm,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? colors.primary : colors.outlineVariant,
                }}
              >
                <View
                  style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: selected ? colors.primaryContainer : colors.surfaceVariant,
                    alignItems: 'center', justifyContent: 'center',
                    marginRight: spacing.md,
                  }}
                >
                  <Comp name={svc.icon} size={22} color={selected ? colors.primary : colors.onSurfaceVariant} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ color: colors.onSurface, fontWeight: '600' }}>
                    {svc.label}
                  </AppText>
                  <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                    {svc.description}
                  </AppText>
                  {!svc.available && (
                    <AppText variant="bodySmall" style={{ color: colors.primary, fontStyle: 'italic' }}>
                      Coming soon — still select if you offer this
                    </AppText>
                  )}
                </View>
                {selected && <MaterialIcons name="check-circle" size={24} color={colors.primary} />}
              </AppCard>
            );
          })}

          {selectedServices.length > 0 && (
            <AppCard elevation={0} style={{ backgroundColor: colors.primaryContainer, marginTop: spacing.xs }}>
              <AppText variant="bodySmall" style={{ color: colors.onPrimaryContainer }}>
                ✅ {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected
              </AppText>
            </AppCard>
          )}
        </>
      )}

      {/* ── Step 2: Guarantor ── */}
      {step === 2 && (
        <>
          <AppText variant="titleMedium" style={{ color: colors.onBackground, marginBottom: spacing.xs }}>
            Guarantor Information
          </AppText>
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.md }}>
            Your guarantor vouches for your character and will be contacted if needed. They must be a responsible adult who has known you for at least 2 years.
          </AppText>

          <AppCard elevation={0} style={{ backgroundColor: colors.errorContainer ?? colors.surfaceVariant, marginBottom: spacing.md }}>
            <AppText variant="bodySmall" style={{ color: colors.onErrorContainer ?? colors.onSurface }}>
              ⚠️ Providing false guarantor details is grounds for immediate deactivation and possible prosecution.
            </AppText>
          </AppCard>

          <AppInput
            label="Guarantor Full Name"
            value={gName}
            onChangeText={setGName}
            inputProps={{ placeholder: 'Full legal name' }}
          />

          <AppInput
            label="Guarantor Phone Number"
            value={gPhone}
            onChangeText={setGPhone}
            inputProps={{ keyboardType: 'phone-pad', placeholder: '080XXXXXXXX' }}
          />

          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.xs }}>
            Relationship to Guarantor
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.base }}>
            {GUARANTOR_RELATIONS.map((rel) => (
              <AppCard
                key={rel}
                elevation={0}
                onPress={() => setGRel(rel)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: gRelation === rel ? colors.primary : colors.outline,
                  backgroundColor: gRelation === rel ? colors.primaryContainer : colors.surface,
                }}
              >
                <AppText variant="bodySmall" style={{ color: gRelation === rel ? colors.onPrimaryContainer : colors.onSurface }}>
                  {rel}
                </AppText>
              </AppCard>
            ))}
          </View>

          <AppInput
            label="Guarantor Residential Address"
            value={gAddress}
            onChangeText={setGAddr}
            inputProps={{ placeholder: 'House no, street, area, city' }}
          />

          <AppInput
            label="Guarantor NIN (optional but recommended)"
            value={gNin}
            onChangeText={(t) => setGNin(t.replace(/\D/g, '').slice(0, 11))}
            inputProps={{ keyboardType: 'numeric', placeholder: '11-digit NIN', maxLength: 11 }}
            helper="Providing guarantor NIN speeds up your verification."
          />
        </>
      )}

      {/* ── Step 3: Bank Details & Submit ── */}
      {step === 3 && (
        <>
          <AppText variant="titleMedium" style={{ color: colors.onBackground, marginBottom: spacing.xs }}>
            Payment Details
          </AppText>
          <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.md }}>
            Your earnings will be paid directly into this account. Ensure the details are correct.
          </AppText>

          <AppInput
            label="Bank Name"
            value={bankName}
            onChangeText={setBankName}
            inputProps={{ placeholder: 'e.g. Guaranty Trust Bank (GTB)' }}
          />

          <AppInput
            label="Account Number (10 digits)"
            value={accountNo}
            onChangeText={(t) => setAccountNo(t.replace(/\D/g, '').slice(0, 10))}
            inputProps={{ keyboardType: 'numeric', placeholder: '0123456789', maxLength: 10 }}
          />

          <AppInput
            label="Account Name (as registered with bank)"
            value={accountName}
            onChangeText={setAccountName}
            inputProps={{ placeholder: 'Full name on account' }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.md }}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLarge" style={{ color: colors.onSurface }}>Available for jobs immediately</AppText>
              <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                You can change this any time from your dashboard.
              </AppText>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={setAvailable}
              trackColor={{ false: colors.outline, true: colors.primaryContainer }}
              thumbColor={isAvailable ? colors.primary : colors.onSurfaceVariant}
            />
          </View>

          <AppCard elevation={0} style={{ backgroundColor: colors.surfaceVariant, marginBottom: spacing.md }}>
            <AppText variant="bodySmall" style={{ color: colors.onSurfaceVariant, lineHeight: 20 }}>
              By submitting, you agree that:
              {'\n'}• Your details will be verified by the JANCO team within 2–3 working days
              {'\n'}• Your NIN and guarantor information will be cross-referenced with NIMC records
              {'\n'}• You will be notified via SMS and in-app upon approval or rejection
              {'\n'}• You may be invited for a short in-person or video verification session
            </AppText>
          </AppCard>
        </>
      )}

      {/* ── Navigation buttons ── */}
      <View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm }}>
        {step > 0 && (
          <AppButton title="Back" variant="outlined" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />
        )}
        <AppButton
          title={step === 3 ? 'Submit Application' : 'Continue'}
          onPress={handleNext}
          disabled={!canNext()}
          loading={loading}
          style={{ flex: 1 }}
        />
      </View>
    </ScreenWrapper>
  );
}
