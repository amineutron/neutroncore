# ntfy neutroncore

Serveur push local (tailnet) pour les notifications téléphone de neutroncore.

```bash
cd ~/dev/neutroncore/ntfy
docker compose up -d
# créer l'utilisateur de l'API (une fois) et son jeton :
docker exec -it ntfy ntfy user add --role=admin neutroncore
docker exec -it ntfy ntfy token add neutroncore
# -> mettre le jeton dans ~/.lyra-control.env : NTFY_TOKEN=tk_xxx (et dans Vaultwarden)
```

Côté téléphone : app ntfy (F-Droid / Play) > + > topic `neutroncore-sessions`,
serveur `http://<IP_TAILSCALE_DU_PC>:8377`, identifiants `neutroncore` + mot de passe,
livraison instantanée activée. Le clic sur la notification ouvre neutroncore
sur la session concernée.
