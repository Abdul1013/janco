import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { Colors, Typography } from '../components/theme/Theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';

export default function BookingScreen({ navigation }) {
  const [image, setImage] = useState(null);
  const [scans, setScans] = useState([]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert('Permission to access media library is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const selectedImage = result.assets[0].uri;
      const fakeArea = Math.floor(Math.random() * 20 + 10); // mock m² estimate
      setScans([...scans, { uri: selectedImage, area: fakeArea }]);
      setImage(selectedImage);
    }
  };

  const handleSubmit = () => {
    if (scans.length > 0) {
      navigation.navigate('PricingEstimate', { scannedImages: scans });
    } else {
      alert('Please upload at least one image before continuing.');
    }
  };

  return (
    <SafeAreaView style={Typography.container}>
     <Header title={"Book a Service"}/>
      <Text style={styles.subtitle}>Choose one or more spaces to estimate area and cost.</Text>

      <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
        <Icon name="upload" size={32} color="#888" />
        <Text style={styles.uploadText}>Tap to upload image</Text>
      </TouchableOpacity>

      <ScrollView style={styles.scanList}>
        {scans.map((scan, index) => (
          <View key={index} style={styles.scanCard}>
            <Image source={{ uri: scan.uri }} style={styles.scanImage} />
            <Text style={styles.scanText}>{scan.area} m²</Text>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.continueButton} onPress={handleSubmit}>
        <Text style={styles.continueText}>Continue to Estimate</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  title: {
  
    textAlign:'center'
  },
  subtitle: {
    fontSize: 16,
    color: '#BBB',
    marginBottom: 20,
    textAlign:'center'

  },
  uploadBox: {
    borderWidth: 2,
    borderColor: '#444',
    borderRadius: 12,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    marginBottom: 20,
  },
  uploadText: {
    marginTop: 10,
    color: '#888',
  },
  scanList: {
    maxHeight: 220,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    marginBottom: 10,
    padding: 10,
    justifyContent: 'space-between'
  },
  scanImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  scanText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFF',
  },
  continueButton: {
    marginTop: "auto",
    marginBottom: 10,
    backgroundColor: '#F9CB40',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  continueText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
});

// [ Header ]            → “Select a Service”
// [ Service Options ]   → Cards with icons
// [ Form Fields ]       → Room type, size, date/time, frequency
// [ Optional Add-ons ]  → Extra toggles
// [ Price Estimate ]    → Live calculator
// [ CTA Button ]        → “Book Service”