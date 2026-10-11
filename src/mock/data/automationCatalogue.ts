// Catalogue des automatisations pour le mode démo. GÉNÉRÉ depuis l'API
// (lib/automations.py : catalogue()) — ne pas éditer à la main, régénérer quand
// un bloc est ajouté côté API.
export const AUTOMATION_CATALOGUE = {
  "triggers": [
    {
      "type": "manual",
      "label": "à la main (routine)",
      "params": []
    },
    {
      "type": "time",
      "label": "à heure fixe",
      "params": [
        {
          "name": "time",
          "type": "time"
        },
        {
          "name": "days",
          "type": "days"
        }
      ]
    },
    {
      "type": "interval",
      "label": "à intervalle régulier",
      "params": [
        {
          "name": "every_min",
          "type": "int",
          "min": 5,
          "max": 1440
        }
      ]
    },
    {
      "type": "alert",
      "label": "une alerte système",
      "params": [
        {
          "name": "kind",
          "type": "choice",
          "choices": [
            "any",
            "disk",
            "unit",
            "backup",
            "rotation",
            "memory",
            "agenda"
          ]
        },
        {
          "name": "when",
          "type": "choice",
          "choices": [
            "raised",
            "resolved"
          ]
        },
        {
          "name": "level",
          "type": "choice",
          "choices": [
            "any",
            "warn",
            "crit"
          ]
        }
      ]
    },
    {
      "type": "resource",
      "label": "une ressource dépasse un seuil",
      "params": [
        {
          "name": "metric",
          "type": "choice",
          "choices": [
            "cpu",
            "ram",
            "vram",
            "gpu_temp",
            "disk"
          ]
        },
        {
          "name": "above",
          "type": "int",
          "min": 1,
          "max": 110
        },
        {
          "name": "for_min",
          "type": "int",
          "min": 1,
          "max": 60
        }
      ]
    },
    {
      "type": "download_done",
      "label": "un téléchargement se termine",
      "params": [
        {
          "name": "contains",
          "type": "otext",
          "max": 60
        }
      ]
    },
    {
      "type": "request",
      "label": "une nouvelle demande de film ou série",
      "params": []
    },
    {
      "type": "agenda",
      "label": "un événement de l'agenda approche",
      "params": [
        {
          "name": "category",
          "type": "choice",
          "choices": [
            "any",
            "perso",
            "systeme",
            "sauvegardes"
          ]
        },
        {
          "name": "minutes_before",
          "type": "int",
          "min": 0,
          "max": 120
        }
      ]
    },
    {
      "type": "session",
      "label": "une session claude",
      "params": [
        {
          "name": "when",
          "type": "choice",
          "choices": [
            "waiting",
            "done"
          ]
        },
        {
          "name": "contains",
          "type": "otext",
          "max": 60
        }
      ]
    },
    {
      "type": "service",
      "label": "un service change d'état",
      "params": [
        {
          "name": "name",
          "type": "choice",
          "choices": [
            "any",
            "lyra",
            "n8n",
            "tracking",
            "plex",
            "radarr",
            "sonarr",
            "bazarr"
          ]
        },
        {
          "name": "state",
          "type": "choice",
          "choices": [
            "down",
            "up"
          ]
        }
      ]
    },
    {
      "type": "tv",
      "label": "la tv s'allume ou s'éteint",
      "params": [
        {
          "name": "state",
          "type": "choice",
          "choices": [
            "on",
            "off"
          ]
        }
      ]
    },
    {
      "type": "lights",
      "label": "les lumières s'allument ou s'éteignent",
      "params": [
        {
          "name": "state",
          "type": "choice",
          "choices": [
            "on",
            "off"
          ]
        }
      ]
    },
    {
      "type": "event",
      "label": "un événement externe (script, n8n)",
      "params": [
        {
          "name": "name",
          "type": "id"
        }
      ]
    },
    {
      "type": "startup",
      "label": "au démarrage de neutroncore",
      "params": []
    }
  ],
  "conditions": [
    {
      "type": "time_between",
      "label": "entre deux heures",
      "params": [
        {
          "name": "start",
          "type": "time"
        },
        {
          "name": "end",
          "type": "time"
        }
      ]
    },
    {
      "type": "days",
      "label": "certains jours",
      "params": [
        {
          "name": "days",
          "type": "days"
        }
      ]
    },
    {
      "type": "tv_is",
      "label": "la tv est",
      "params": [
        {
          "name": "state",
          "type": "choice",
          "choices": [
            "on",
            "off"
          ]
        }
      ]
    },
    {
      "type": "lights_are",
      "label": "les lumières sont",
      "params": [
        {
          "name": "state",
          "type": "choice",
          "choices": [
            "on",
            "off"
          ]
        }
      ]
    },
    {
      "type": "service_is",
      "label": "un service est",
      "params": [
        {
          "name": "name",
          "type": "choice",
          "choices": [
            "lyra",
            "n8n",
            "tracking",
            "plex",
            "radarr",
            "sonarr",
            "bazarr"
          ]
        },
        {
          "name": "state",
          "type": "choice",
          "choices": [
            "up",
            "down"
          ]
        }
      ]
    },
    {
      "type": "downloading",
      "label": "un téléchargement est en cours",
      "params": [
        {
          "name": "state",
          "type": "choice",
          "choices": [
            "yes",
            "no"
          ]
        }
      ]
    },
    {
      "type": "session_waiting",
      "label": "une session claude attend",
      "params": [
        {
          "name": "state",
          "type": "choice",
          "choices": [
            "yes",
            "no"
          ]
        }
      ]
    },
    {
      "type": "alert_active",
      "label": "une alerte est en cours",
      "params": [
        {
          "name": "kind",
          "type": "choice",
          "choices": [
            "any",
            "disk",
            "unit",
            "backup",
            "rotation",
            "memory",
            "agenda"
          ]
        }
      ]
    },
    {
      "type": "resource",
      "label": "une ressource est",
      "params": [
        {
          "name": "metric",
          "type": "choice",
          "choices": [
            "cpu",
            "ram",
            "vram",
            "gpu_temp",
            "disk"
          ]
        },
        {
          "name": "op",
          "type": "choice",
          "choices": [
            "above",
            "below"
          ]
        },
        {
          "name": "value",
          "type": "int",
          "min": 0,
          "max": 110
        }
      ]
    }
  ],
  "actions": [
    {
      "action": "hue.scene",
      "label": "scène hue",
      "params": [
        {
          "name": "scene_id",
          "type": "id"
        }
      ]
    },
    {
      "action": "hue.off",
      "label": "lumières : tout éteindre",
      "params": []
    },
    {
      "action": "hue.brightness",
      "label": "lumières : intensité",
      "params": [
        {
          "name": "brightness",
          "type": "int",
          "min": 1,
          "max": 254
        }
      ]
    },
    {
      "action": "tv.power",
      "label": "tv : allumer / éteindre",
      "params": [
        {
          "name": "on",
          "type": "bool"
        }
      ]
    },
    {
      "action": "tv.app",
      "label": "tv : ouvrir une application",
      "params": [
        {
          "name": "app",
          "type": "choice",
          "choices": [
            "plex",
            "youtube",
            "netflix",
            "disney",
            "prime"
          ]
        }
      ]
    },
    {
      "action": "tv.ambilight",
      "label": "tv : ambilight",
      "params": [
        {
          "name": "mode",
          "type": "choice",
          "choices": [
            "FOLLOW_VIDEO",
            "FOLLOW_AUDIO",
            "LOUNGE_LIGHT",
            "OFF"
          ]
        }
      ]
    },
    {
      "action": "denon.volume",
      "label": "ampli : volume",
      "params": [
        {
          "name": "level",
          "type": "int",
          "min": 0,
          "max": 60
        }
      ]
    },
    {
      "action": "denon.source",
      "label": "ampli : entrée",
      "params": [
        {
          "name": "source",
          "type": "choice",
          "choices": [
            "TV",
            "BD",
            "GAME",
            "SAT/CBL",
            "DVD",
            "MPLAY"
          ]
        }
      ]
    },
    {
      "action": "wait",
      "label": "attendre",
      "params": [
        {
          "name": "seconds",
          "type": "int",
          "min": 1,
          "max": 60
        }
      ]
    },
    {
      "action": "hue.on",
      "label": "lumières : tout allumer",
      "params": []
    },
    {
      "action": "hue.color",
      "label": "lumières : couleur",
      "params": [
        {
          "name": "color",
          "type": "color"
        }
      ]
    },
    {
      "action": "hue.light",
      "label": "une lampe : allumer / éteindre",
      "params": [
        {
          "name": "light",
          "type": "light"
        },
        {
          "name": "on",
          "type": "bool"
        }
      ]
    },
    {
      "action": "tv.key",
      "label": "tv : touche de télécommande",
      "params": [
        {
          "name": "key",
          "type": "choice",
          "choices": [
            "Home",
            "Back",
            "Confirm",
            "CursorUp",
            "CursorDown",
            "CursorLeft",
            "CursorRight",
            "Play",
            "Pause",
            "Stop",
            "FastForward",
            "Rewind",
            "Mute",
            "Source",
            "Options",
            "Info",
            "AmbilightOnOff"
          ]
        }
      ]
    },
    {
      "action": "tv.mute",
      "label": "tv : couper / remettre le son",
      "params": [
        {
          "name": "muted",
          "type": "bool"
        }
      ]
    },
    {
      "action": "tv.screen",
      "label": "tv : écran allumé / éteint (son gardé)",
      "params": [
        {
          "name": "on",
          "type": "bool"
        }
      ]
    },
    {
      "action": "denon.mute",
      "label": "ampli : couper / remettre le son",
      "params": [
        {
          "name": "muted",
          "type": "bool"
        }
      ]
    },
    {
      "action": "pc.screens",
      "label": "écrans du pc : allumer / éteindre",
      "params": [
        {
          "name": "on",
          "type": "bool"
        }
      ]
    },
    {
      "action": "routine.run",
      "label": "lancer une routine",
      "params": [
        {
          "name": "id",
          "type": "id"
        }
      ]
    },
    {
      "action": "lyra.tool",
      "label": "demander à lyra",
      "params": [
        {
          "name": "phrase",
          "type": "text",
          "max": 200
        },
        {
          "name": "tool",
          "type": "tool"
        },
        {
          "name": "arguments",
          "type": "args"
        }
      ]
    },
    {
      "action": "notify.app",
      "label": "notification dans l'app",
      "params": [
        {
          "name": "message",
          "type": "text",
          "max": 200
        }
      ]
    },
    {
      "action": "notify.phone",
      "label": "notification sur le téléphone",
      "params": [
        {
          "name": "message",
          "type": "text",
          "max": 200
        },
        {
          "name": "title",
          "type": "otext",
          "max": 60
        },
        {
          "name": "priority",
          "type": "choice",
          "choices": [
            "normale",
            "basse",
            "haute"
          ]
        }
      ]
    },
    {
      "action": "service.start",
      "label": "démarrer un service",
      "params": [
        {
          "name": "name",
          "type": "choice",
          "choices": [
            "lyra",
            "n8n",
            "tracking",
            "plex",
            "radarr",
            "sonarr",
            "bazarr"
          ]
        }
      ]
    }
  ],
  "variables": [
    "nom",
    "declencheur",
    "titre",
    "heure",
    "date",
    "jour"
  ],
  "report_variables": [
    "nom",
    "declencheur",
    "titre",
    "heure",
    "date",
    "jour",
    "resultat",
    "echecs",
    "duree"
  ],
  "limits": {
    "conditions": 4,
    "actions": 12,
    "retry": 2,
    "per_day": 50,
    "report": 300
  },
  "no_retry": [
    "tv.key",
    "routine.run",
    "wait",
    "lyra.tool"
  ]
}
