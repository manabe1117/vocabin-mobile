# 16 KB ページサイズ対応の履歴

Google Play Console での「このアプリは 16 KB メモリのページサイズをサポートしていません」エラーに対する対応履歴です。

## 試行した対策と結果

### 1. ビルドツールチェーンの更新

- **AGP (Android Gradle Plugin) の更新**
  - 8.5.1 未満から **8.7.3** に更新
  - 目的: AGP 8.5 以降でのデフォルト 16 KB 対応を有効化
- **Gradle の更新**
  - 8.10.2 から **8.11.1** に更新
  - 目的: 新しい AGP との互換性確保
- **NDK の更新**
  - 27.0.12077973 から **27.1.12297006** (LTS) に変更
  - 試行錯誤: 一時 28.0 系を試したがライセンス問題等のため 27.1 に固定
  - `android/app/build.gradle` の `ndkVersion` 指定を削除し、React Native のデフォルト管理に委譲

### 2. ビルド設定の調整

- **ネイティブライブラリの非圧縮化 (Uncompressed Native Libs)**

  - `android/gradle.properties`:
    - `expo.useLegacyPackaging=false` を設定
    - 非推奨の `android.bundle.enableUncompressedNativeLibs` は削除
  - `android/app/build.gradle`:
    - `packagingOptions.jniLibs.useLegacyPackaging = false` を強制的に設定
  - 目的: ライブラリを非圧縮で格納し、ページサイズアライメントを有効にするため

- **ABI フィルタの削除**
  - `android/app/build.gradle` から `ndk { abiFilters ... }` を削除
  - 目的: ビルド構成をシンプルにし、必要な ABI が自動選択されるようにするため

### 3. ビルド手順の改善

- **キャッシュのクリア**
  - `Invalidate Caches` (File system cache 含む) を実行
  - `Build > Clean Project` を実行
- **リリースビルド手順**
  - `Build > Rebuild Project` の徹底
  - `Generate Signed Bundle / APK` からの手動ビルド

## 現状の状態 (バージョン 1.0.19)

### 設定ファイルの状態

**android/build.gradle**

```groovy
dependencies {
    classpath('com.android.tools.build:gradle:8.7.3') // 最新AGP
    // ...
}
```

**android/gradle/wrapper/gradle-wrapper.properties**

```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.11.1-all.zip
```

**android/app/build.gradle**

```groovy
android {
    // ndkVersion 指定なし (デフォルト使用)
    packagingOptions {
        jniLibs {
            useLegacyPackaging = false // 強制的に非圧縮
        }
        exclude 'META-INF/LICENSE'
        exclude 'META-INF/NOTICE'
    }
}
```

**android/gradle.properties**

```properties
expo.useLegacyPackaging=false
```

## 追記: NDK r27 への完全移行と互換モードの適用 (バージョン 1.0.15 - 今回の対応)

バージョン 1.0.19 (以前の試行) での対応でも解決しなかったため、以下の強力な対策を追加しました。

### 4. 新規追加対応

- **NDK バージョンの明示的指定 (r27)**

  - `android/app/build.gradle` に `ndkVersion "27.0.12077973"` を追加。
  - React Native デフォルトの NDK (r26 系) は 4KB ページサイズがデフォルトのため、16KB 対応がデフォルトである r27 系を強制使用。

- **extractNativeLibs の有効化 (Android 15 互換モード)**

  - `android/app/src/main/AndroidManifest.xml` に `android:extractNativeLibs="true"` を追加。
  - APK/AAB 内でライブラリが圧縮されていても、インストール時に展開されるため、OS のファイルシステム上で正しいページアライメントが確保される。

- **Legacy Packaging の有効化**
  - `android/gradle.properties` で `expo.useLegacyPackaging=true` に変更。
  - これによりライブラリが圧縮状態でパッケージングされ、`extractNativeLibs="true"` と組み合わせて展開される挙動となる。

### 最新の設定状態 (バージョン 1.0.15)

**android/app/src/main/AndroidManifest.xml**

```xml
<application
    android:extractNativeLibs="true"
    ... >
```

**android/app/build.gradle**

```groovy
android {
    ndkVersion "27.0.12077973" // 明示的に追加
    packagingOptions {
        // ...
    }
}
```

**android/gradle.properties**

```properties
expo.useLegacyPackaging=true // false から変更
```

## 追記: 全モジュールへの NDK 適用と Legacy Packaging の徹底 (バージョン 1.0.20)

バージョン 1.0.19 での対応でも解決しなかったため、以下の対策を追加で実施しました。
(※ バージョン 1.0.20 はビルドエラーによりリリースできず)

### 5. 全サブプロジェクトへの NDK バージョン強制

- **`android/build.gradle` (Root)**
  - `subprojects` ブロックを追加し、全てのモジュールに対して `ndkVersion = "27.1.12297006"` を強制的に適用。
  - これにより、依存ライブラリが古い NDK でビルドされることを防ぎます。

### 6. Legacy Packaging の再有効化

- **`android/app/build.gradle`**
  - `packagingOptions.jniLibs.useLegacyPackaging = true` に設定。
- **`android/gradle.properties`**
  - `expo.useLegacyPackaging=true` に設定。
- **理由**: `extractNativeLibs="true"` (AndroidManifest.xml) と組み合わせることで、インストール時にライブラリを展開し、ページアライメントを確保する「互換モード」を確実に動作させるため。

### 最新の設定状態 (バージョン 1.0.20)

**android/build.gradle**

```groovy
subprojects {
    afterEvaluate { project ->
        if (project.hasProperty("android")) {
            project.android {
                ndkVersion = "27.1.12297006"
            }
        }
    }
}
```

**android/app/build.gradle**

```groovy
android {
    ndkVersion "27.1.12297006"
    // ...
    packagingOptions {
        jniLibs {
            useLegacyPackaging = true
        }
    }
}
```

**android/gradle.properties**

```properties
expo.useLegacyPackaging=true
```

## 追記: ビルドエラー修正と NDK 強制の改善 (バージョン 1.0.21)

バージョン 1.0.20 で `Project.afterEvaluate` エラーが発生したため、より安全な方法で NDK バージョンを強制適用します。

### 7. `plugins.withId` を使用した NDK バージョン強制

- **`android/build.gradle` (Root)**
  - `subprojects { afterEvaluate { ... } }` を削除（エラー原因）。
  - 代わりに `subprojects { project.plugins.withId('com.android.library') { ... } }` を使用。
  - これにより、プラグイン適用タイミングに合わせて安全に `ndkVersion` を設定できます。

### 結果 (バージョン 1.0.21)

- Google Play Console にて一時的にエラーが消えたように見えたが、再度確認するとエラー（バージョンコード 24）が復活。
- **原因推測**: `extractNativeLibs="true"` を使用した「互換モード」が、Google Play Console の AAB 検証を通過できない（AAB 段階でのアライメントを求めている）可能性が高い。

## 追記: 正攻法「非圧縮アライメント」への回帰と完全適用 (バージョン 1.0.22)

「互換モード」での突破を諦め、正攻法である「ライブラリを非圧縮で AAB に含め、ページアライメントを確保する」方針に戻します。
v1.0.19 ではこれが失敗しましたが、v1.0.21 で導入した「全モジュールへの NDK 強制」と組み合わせることで、全てのライブラリが正しくビルド・設定されることを狙います。

### 8. `extractNativeLibs` の無効化と非圧縮設定の強制

- **`AndroidManifest.xml`**
  - `android:extractNativeLibs="true"` を削除（デフォルトの false ＝ 非展開・APK 内アライメント利用に戻す）。
- **`android/app/build.gradle`**
  - `packagingOptions.jniLibs.useLegacyPackaging = false`（非圧縮）に変更。
- **`android/gradle.properties`**
  - `expo.useLegacyPackaging=false` に変更。
  - **追加**: `android.bundle.enableUncompressedNativeLibs=true` を明示的に追加（AGP の挙動を確実に制御するため）。

### 結果: Google Play Console でのエラー解消 (バージョン 1.0.22)

- Google Play Console にて「このアプリは 16 KB メモリのページサイズをサポートしていません」のエラーが完全に解消され、リリース可能であることを確認。
- **成功の鍵**:
  1.  **全モジュールの NDK 強制 (v1.0.21)**: 依存ライブラリも含めて全て NDK r27 でビルド。
  2.  **非圧縮設定 (v1.0.22)**: `extractNativeLibs` を削除し、ネイティブライブラリを非圧縮で格納することで、OS のページアライメント機能を正しく利用できるようにした。

### 最新の設定状態 (バージョン 1.0.22)

**android/build.gradle**

```groovy
// 全モジュール NDK 強制は維持
subprojects {
    project.plugins.withId('com.android.library') {
        project.android {
            ndkVersion = "27.1.12297006"
        }
    }
}
```

**android/app/src/main/AndroidManifest.xml**

```xml
<!-- android:extractNativeLibs 属性を削除 -->
<application ... >
```

**android/app/build.gradle**

```groovy
packagingOptions {
    jniLibs {
        useLegacyPackaging = false // 非圧縮 (Uncompressed)
    }
}
```

**android/gradle.properties**

```properties
expo.useLegacyPackaging=false
android.bundle.enableUncompressedNativeLibs=true
```

## 追記: 成功した設定への切り戻し (バージョン 1.0.28)

バージョン 1.0.27 (ライブラリ更新) でも解決しなかったとのことで、過去に成功実績のあるコミット (`970f1687...` = バージョン 1.0.22 相当) の設定に戻します。

### 変更点

1.  **`package.json`**: ライブラリバージョンを元に戻しました（Ads 14.x, Reanimated 3.16.x）。
2.  **`android/app/build.gradle`**: `abiFilters` (32bit 除外設定) を削除しました。32bit/64bit 両方のライブラリを含めます。
3.  **`android/gradle.properties`**: `android.bundle.enableUncompressedNativeLibs=true` を再設定しました。

### 結果 (バージョン 1.0.28)

- **成功**: Google Play Console へのアップロードと 16KB エラーの解消を確認。
- **結論**:
  - バージョン 1.0.22 の構成（全モジュール NDK 強制 + 非圧縮設定 + 32bit 含める）が正解だった。
  - 途中で行った「32bit アーキテクチャの除外」や「ライブラリの無理なバージョンアップ」は不要だった（あるいは逆効果だった）。
  - 重要なのは `subprojects { ... ndkVersion ... }` による依存ライブラリの強制ビルドと、適切な非圧縮設定の組み合わせである。
