#!/usr/bin/env bash
# neutroncore — fenetre bureau flottante (chrome --app)
# NB: Chrome sous Wayland ignore --class ; la classe reelle derivee de l'URL est
# "chrome-127.0.0.1__app_-Default".
URL="http://127.0.0.1:9876/app/"
CLASS='chrome-127.0.0.1__app_-Default'

# On cherche la FENETRE, pas le process : si chrome a ete demarre par ce script,
# le process principal garde --app=$URL dans sa ligne de commande meme apres la
# fermeture de la fenetre (les autres fenetres chrome le maintiennent en vie).
if hyprctl clients -j 2>/dev/null | jq -e --arg c "$CLASS" 'any(.[]; .class == $c)' >/dev/null; then
  # instance deja ouverte : focus + rechargement (F5) pour servir le dernier build
  hyprctl dispatch focuswindow "class:$CLASS" >/dev/null 2>&1
  hyprctl dispatch sendshortcut ",F5,class:$CLASS" >/dev/null 2>&1
  exit 0
fi
# fenetre flottante centree pour la classe reelle de chrome --app
hyprctl keyword windowrulev2 "float,class:^(${CLASS})$" >/dev/null 2>&1
hyprctl keyword windowrulev2 "size 1360 860,class:^(${CLASS})$" >/dev/null 2>&1
hyprctl keyword windowrulev2 "center,class:^(${CLASS})$" >/dev/null 2>&1
exec google-chrome --app="$URL" >/dev/null 2>&1 &
