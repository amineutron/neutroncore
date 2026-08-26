#!/usr/bin/env bash
#
# build-apk.sh - Fabrique l'APK Android de neutroncore.
#
# L'application charge l'interface depuis le tailnet (voir capacitor.config.ts) :
# un simple `npm run build` suffit pour mettre a jour ce que le telephone
# affiche. Ce script n'est a relancer QUE si la coque native change
# (icone, permissions, version de Capacitor, adresse du serveur).
#
# Usage :
#   ./build-apk.sh            # APK de debogage (installable, non signee)
#   ./build-apk.sh --install  # + installation sur le telephone branche en USB
#
set -euo pipefail

cd "$(dirname "$0")"
export ANDROID_HOME="${ANDROID_HOME:-/mnt/nvme-storage/android-sdk}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERREUR]${NC} $1" >&2; }

[[ -d "$ANDROID_HOME" ]] || { err "SDK Android introuvable: $ANDROID_HOME"; exit 1; }

info "Compilation du frontend..."

# --- Fichiers Android generes depuis les templates .in et .env.local (jamais commites)
[[ -f .env.local ]] || { err "Pas de .env.local : copie .env.example et adapte-le."; exit 1; }
set -a; source .env.local; set +a
: "${NEUTRONCORE_TAILSCALE_IP:?manquant dans .env.local}"; : "${NEUTRONCORE_TAILNET:?manquant}"; : "${VITE_MEDIA_HOST:?manquant}"
for tpl in android/app/src/main/AndroidManifest.xml.in android/app/src/main/res/xml/network_security_config.xml.in; do
    sed -e "s|@NEUTRONCORE_TAILSCALE_IP@|$NEUTRONCORE_TAILSCALE_IP|g" \
        -e "s|@NEUTRONCORE_TAILNET@|$NEUTRONCORE_TAILNET|g" \
        -e "s|@MEDIA_HOST@|$VITE_MEDIA_HOST|g" "$tpl" > "${tpl%.in}"
done

npm run build >/dev/null

info "Synchronisation de la coque native..."
npx cap sync android >/dev/null

info "Construction de l'APK (peut prendre quelques minutes)..."
(cd android && ./gradlew assembleDebug --no-daemon -q)

APK="android/app/build/outputs/apk/debug/app-debug.apk"
[[ -f "$APK" ]] || { err "APK non produite"; exit 1; }
info "APK prete : $APK ($(du -h "$APK" | cut -f1))"

if [[ "${1:-}" == "--install" ]]; then
    # La TV Philips est appairee en ADB reseau (<ip-tv>:5555) : on ne
    # garde QUE les appareils USB (leur identifiant ne contient pas de ":")
    mapfile -t USB < <(adb devices | tail -n +2 | awk '$2=="device" && $1 !~ /:/ {print $1}')
    if [[ ${#USB[@]} -eq 0 ]]; then
        err "Aucun telephone branche en USB."
        err "1. Branche le telephone au PC"
        err "2. Active le debogage USB (Parametres > A propos > appuyer 7 fois"
        err "   sur le numero de build, puis Options developpeur > Debogage USB)"
        err "3. Accepte la demande d'autorisation affichee sur le telephone"
        err "4. Verifie avec : adb devices"
        exit 1
    fi
    if [[ ${#USB[@]} -gt 1 ]]; then
        err "Plusieurs appareils USB : ${USB[*]}"
        err "Relance avec : adb -s <identifiant> install -r $APK"
        exit 1
    fi
    DEV="${USB[0]}"
    info "Installation sur $(adb -s "$DEV" shell getprop ro.product.model | tr -d '\r') ($DEV)..."
    adb -s "$DEV" install -r "$APK"
    info "Installe. L'application s'appelle « neutroncore » dans le tiroir."
else
    echo
    info "Pour installer :"
    echo "  - par cable : ./build-apk.sh --install  (telephone branche, debogage USB actif)"
    echo "  - sans cable : copie $APK sur le telephone et ouvre-la"
fi
