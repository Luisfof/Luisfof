#!/usr/bin/env bash
# Gera o APK (invólucro WebView) do MORAA GO, sem Gradle.
# Uso: ANDROID_HOME=/caminho/sdk android/build-apk.sh https://sua-url-https [saida.apk]
# Requer: JDK 17+, Android SDK com platforms;android-34 e build-tools;35.0.0.
set -euo pipefail
URL="${1:?informe a URL HTTPS da plataforma}"; URL="${URL%/}"
[[ "$URL" == https://* ]] || { echo "A URL precisa ser https://"; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"; OUT="${2:-$HERE/moraa-go-demo.apk}"
BT="$ANDROID_HOME/build-tools/35.0.0"; JAR="$ANDROID_HOME/platforms/android-34/android.jar"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
cp "$HERE/../public/icons/maskable-512.png" "$HERE/res/mipmap-xxxhdpi/ic_launcher.png"
cp "$HERE/../public/icons/maskable-192.png" "$HERE/res/mipmap-xxhdpi/ic_launcher.png"
mkdir -p "$W/src/br/com/moraago/app" "$W/classes" "$W/dex"
sed "s#__BASE_URL__#$URL#" "$HERE/src/br/com/moraago/app/MainActivity.java" > "$W/src/br/com/moraago/app/MainActivity.java"
"$BT/aapt2" compile --dir "$HERE/res" -o "$W/res.zip"
"$BT/aapt2" link --min-sdk-version 24 --target-sdk-version 34 --version-code 1 --version-name 1.0-demo -o "$W/base.apk" -I "$JAR" --manifest "$HERE/AndroidManifest.xml" "$W/res.zip"
javac -nowarn -source 11 -target 11 -classpath "$JAR" -d "$W/classes" "$W/src/br/com/moraago/app/MainActivity.java" 2>/dev/null
"$BT/d8" --min-api 24 --lib "$JAR" --output "$W/dex" $(find "$W/classes" -name '*.class')
(cd "$W/dex" && zip -q "$W/base.apk" classes.dex)
"$BT/zipalign" -f 4 "$W/base.apk" "$W/aligned.apk"
# Chave de DEMONSTRAÇÃO (não serve para a Play Store). Guarde uma chave própria para publicar.
KS="${MORAA_KEYSTORE:-$HERE/demo.keystore}"
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storepass moraademo -keypass moraademo -alias moraa -keyalg RSA -keysize 2048 -validity 3650 -dname "CN=MORAA GO Demo" >/dev/null 2>&1
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:moraademo --key-pass pass:moraademo --out "$OUT" "$W/aligned.apk"
"$BT/apksigner" verify "$OUT" && echo "APK: $OUT ($(du -h "$OUT" | cut -f1)) → $URL"
