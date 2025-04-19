// components/CameraModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Text } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';

interface CameraModalProps {
  isVisible: boolean;
  onClose: () => void;
  onPictureTaken: (base64Image: string) => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ isVisible, onClose, onPictureTaken }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const [flashMode, setFlashMode] = useState<'on' | 'off'>('off');

  useEffect(() => {
    if (isVisible && !permission?.granted) {
      requestPermission();
    }
  }, [isVisible, permission]);

  const handleTakePicture = async () => {
    if (!cameraRef.current || isTakingPicture) return;
    setIsTakingPicture(true);
    try {
      const pictureMetadata = await cameraRef.current.takePictureAsync({
        quality: 0.7, // 品質を少し落としてファイルサイズを削減
        // base64: false, // まずはURIを取得してリサイズ
        // exif: false,
      });

      if (pictureMetadata?.uri) {
          // 画像をリサイズしてBase64に変換 (APIによってはサイズ制限があるため)
          const manipulatedImage = await ImageManipulator.manipulateAsync(
            pictureMetadata.uri,
            [{ resize: { width: 1024 } }], // 幅を1024pxにリサイズ (適宜調整)
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          if (manipulatedImage.base64) {
            onPictureTaken(manipulatedImage.base64);
          } else {
              throw new Error('Failed to get base64 data from manipulated image.');
          }
      } else {
          throw new Error('Failed to take picture or URI is missing.');
      }
    } catch (error: any) {
      console.error('Failed to take picture:', error);
      Alert.alert('撮影エラー', `写真の撮影または処理に失敗しました: ${error.message}`);
    } finally {
      setIsTakingPicture(false);
    }
  };

  const toggleFlash = () => {
    setFlashMode(current => (current === 'off' ? 'on' : 'off'));
  };

  if (!isVisible) return null;

  if (!permission) {
    // Permissions are still loading
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" /></View>;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>カメラへのアクセス許可が必要です。</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>許可する</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.permissionButton, styles.closeButton]} onPress={onClose}>
          <Text style={styles.permissionButtonText}>キャンセル</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        flash={flashMode}
        // mode="picture" // expo-camera v14+
      >
        <View style={styles.controlsContainer}>
          {/* 上部コントロール */}
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
              <Ionicons name={flashMode === 'on' ? 'flash' : 'flash-off'} size={28} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={onClose}>
              <Ionicons name="close" size={32} color="white" />
            </TouchableOpacity>
          </View>

          {/* 下部コントロール (撮影ボタン) */}
          <View style={styles.bottomControls}>
            {isTakingPicture ? (
              <ActivityIndicator size="large" color="white" />
            ) : (
              <TouchableOpacity style={styles.captureButton} onPress={handleTakePicture}>
                <Ionicons name="camera" size={40} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  permissionText: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#1a73e8',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 15,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
      backgroundColor: '#5f6368',
  },
  camera: {
    flex: 1,
  },
  controlsContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 20,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 40 : 20, // Adjust for status bar
  },
  bottomControls: {
    alignItems: 'center',
    paddingBottom: 30,
  },
  controlButton: {
    padding: 10,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CameraModal;