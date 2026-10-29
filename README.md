# Jarvis — assistant vocal Android hors ligne (français)

Équivalent Android de la version Windows en Python : mot de réveil « Jarvis », bip, écoute jusqu'au silence,
transcription **hors ligne**, exécution de la commande, réponse vocale, et un cercle animé façon Jarvis
qui réagit à la voix.

- Kotlin, Jetpack Compose, minSdk 26, targetSdk 34
- Aucune clé d'API, aucun service cloud : seul le **téléchargement initial du modèle** (≈ 41 Mo) utilise Internet
- Service au premier plan de type `microphone`, notification permanente Pause / Quitter
- Sélectionnable comme **Assistant numérique** par défaut (appui long sur Accueil / Alimentation)

---

## 1. Choix techniques

### Mot de réveil

| Solution | Avantages | Inconvénients |
|---|---|---|
| **Porcupine** (Picovoice) | Très précis, très économe | Exige une *AccessKey* liée à un compte et vérifiée en ligne au démarrage, « Jarvis » est fourni en anglais seulement : contraire à « aucune clé obligatoire » |
| **openWakeWord** (ONNX Runtime) | Libre, il existe un modèle « hey jarvis » | Chaîne de 3 réseaux ONNX à porter (mel + embeddings + classifieur), entraîné sur l'anglais, +15 Mo d'ONNX Runtime |
| **Vosk, détection de mot-clé** | Libre, hors ligne, **même moteur et même modèle que la transcription** | Un peu plus gourmand en CPU qu'un détecteur dédié |

**Choix : Vosk en mode « grammaire restreinte »** (`["jarvis", "jar vis", …, "[unk]"]`). Avec un seul moteur et
un seul modèle en mémoire, un seul `AudioRecord` alimente la détection puis la transcription sans rien relâcher entre
les deux. On n'a ni clé ni compte, et la prononciation française de « Jarvis » est reconnue.

### Reconnaissance vocale

**Choix : Vosk + `vosk-model-small-fr-0.22` (41 Mo).** Sur un téléphone de milieu de gamme, il transcrit en temps réel
*pendant* que vous parlez, si bien que le résultat est prêt dès la fin de la phrase. whisper.cpp est plus précis,
mais même le modèle `base` quantifié demande 1 à 3 s **après** la fin de la phrase sur ce type d'appareil, et il
oblige à compiler du code natif (NDK + CMake + JNI), ce qui est lourd pour une première appli Android.

### Synthèse vocale
`TextToSpeech` natif d'Android, voix fr-FR hors ligne choisie automatiquement. La fonction `parler()` est suspendue
jusqu'à la fin réelle de la phrase, ce qui pilote l'état `PAROLE` de l'animation.

---

## 2. Arborescence

```
Jarvis/
├── settings.gradle.kts            dépôts + module unique « app »
├── build.gradle.kts               versions des plugins (AGP 8.5.2, Kotlin 1.9.24)
├── gradle.properties
├── gradlew / gradlew.bat / gradle/wrapper/   wrapper Gradle 8.7
└── app/
    ├── build.gradle.kts           SDK, Compose, Vosk, coroutines
    ├── proguard-rules.pro
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml
        │   ├── java/fr/jarvis/assistant/
        │   │   ├── JarvisApp.kt               Application : canaux de notification, portée globale
        │   │   ├── Reglages.kt                réglages persistants (SharedPreferences)
        │   │   ├── service/
        │   │   │   ├── EtatJarvis.kt          machine à états + StateFlow partagé service/UI
        │   │   │   ├── JarvisService.kt       service premier plan « microphone », boucle audio
        │   │   │   ├── Micro.kt               l'unique AudioRecord partagé
        │   │   │   ├── Notifications.kt       notification permanente, Pause / Quitter
        │   │   │   ├── BootReceiver.kt        démarrage au boot (optionnel)
        │   │   │   └── AssistantVocal.kt      VoiceInteractionService + session + RecognitionService
        │   │   ├── wake/DetecteurMotReveil.kt   détection « Jarvis » (Vosk, grammaire)
        │   │   ├── stt/
        │   │   │   ├── GestionModeles.kt      catalogue, téléchargement, décompression, chargement
        │   │   │   └── Transcripteur.kt       transcription + détection de fin de parole
        │   │   ├── tts/Synthese.kt            TextToSpeech fr-FR, suspendu jusqu'à la fin
        │   │   ├── commandes/
        │   │   │   ├── Commandes.kt           ★ liste des commandes (regex), facile à étendre
        │   │   │   ├── Actions.kt             navigateur, applis, appels, horloge, lampe
        │   │   │   └── TexteFr.kt             nombres en lettres, durées, heures, similarité
        │   │   └── ui/
        │   │       ├── MainActivity.kt        activité unique, navigation entre 3 écrans
        │   │       ├── CercleJarvis.kt        cercle animé (Canvas)
        │   │       ├── EcranPrincipal.kt      plein écran sombre : cercle, état, phrase, réponse
        │   │       ├── EcranAccueil.kt        guide des autorisations + téléchargement du modèle
        │   │       ├── EcranReglages.kt       réglages + liste des commandes
        │   │       ├── Composants.kt          cartes réutilisables
        │   │       ├── Autorisations.kt       vérifications + intents vers les réglages Android
        │   │       └── Theme.kt               couleurs par état
        │   └── res/
        │       ├── drawable/ic_launcher_foreground.xml, ic_notification.xml
        │       ├── mipmap-anydpi-v26/ic_launcher.xml
        │       ├── values/strings.xml, colors.xml, themes.xml
        │       └── xml/voice_interaction.xml, recognition_service.xml
        └── test/java/fr/jarvis/assistant/commandes/ParseurTest.kt   tests du parseur (sur PC)
```

### Machine à états

```
            mot « Jarvis » / bouton Parler
 CHARGEMENT ──► VEILLE ─────────────────► ECOUTE ──silence──► REFLEXION ──► PAROLE ──┐
                  ▲                          │ (rien entendu)                          │
                  └──────────────────────────┴─────────────────────────────────────────┘
       ERREUR : atteignable depuis tout état (micro indisponible, modèle absent…), retour en VEILLE
```

Le service lit le micro par trames de 100 ms sur **un seul thread** et les donne au détecteur (VEILLE) ou au
transcripteur (ECOUTE). En REFLEXION et PAROLE, le micro est arrêté, donc Jarvis ne s'entend pas parler.

---

## 3. Compiler et installer l'APK

### Prérequis
1. **Android Studio** (version Koala 2024.1 ou plus récente) : <https://developer.android.com/studio>.
   Le JDK 17 et le SDK Android sont installés avec lui.
2. Un câble USB **de données** (certains câbles ne font que charger).

### Ouvrir le projet
1. Récupérez le dossier du projet (`git clone` ou téléchargement ZIP de la branche).
2. Android Studio > **File > Open** > sélectionnez le dossier racine `Jarvis/` (celui qui contient `settings.gradle.kts`).
3. Acceptez « Trust project ». La première synchronisation Gradle télécharge environ 500 Mo de dépendances,
   comptez quelques minutes.
4. Si Android Studio propose d'installer *Android SDK Platform 34*, acceptez.

### Activer le débogage USB sur le téléphone
1. **Paramètres > À propos du téléphone** : touchez **7 fois** « Numéro de build »
   (Xiaomi : « Version MIUI/HyperOS » ; Samsung : *Informations sur le logiciel* > « Numéro de version »).
2. **Paramètres > Système > Options pour les développeurs** : activez **Débogage USB**.
   Xiaomi : activez aussi « Installer via USB » et « Débogage USB (paramètres de sécurité) ».
3. Branchez le téléphone et acceptez la fenêtre « Autoriser le débogage USB ? » (cochez « Toujours »).

### Compiler et installer
- **Méthode simple :** sélectionnez votre téléphone dans la liste des appareils en haut d'Android Studio,
  puis cliquez sur ▶ **Run 'app'**. L'APK est compilé, installé et lancé.
- **Pour obtenir le fichier APK :** menu **Build > Build App Bundle(s) / APK(s) > Build APK(s)**.
  Le fichier est créé dans `app/build/outputs/apk/debug/app-debug.apk`.
- **En ligne de commande** (terminal d'Android Studio) :
  ```bash
  ./gradlew assembleDebug          # Windows : gradlew.bat assembleDebug
  adb install -r app/build/outputs/apk/debug/app-debug.apk
  ./gradlew test                   # tests du parseur de commandes
  ```

### Premier lancement
L'écran d'accueil vous guide pas à pas :
1. **Micro** et **Notifications** (obligatoires).
2. **Télécharger le modèle** (≈ 41 Mo, une seule fois, Wi-Fi conseillé).
3. *Recommandé :* batterie sans restriction, affichage par-dessus les autres applis
   (pour que Jarvis puisse ouvrir une appli alors qu'il tourne en arrière-plan).
4. *Optionnel :* contacts + téléphone, assistant numérique par défaut.

**Installer le modèle sans Internet sur le téléphone :** téléchargez
<https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip> sur le PC, décompressez-le, puis :
```bash
adb push vosk-model-small-fr-0.22 /sdcard/Android/data/fr.jarvis.assistant/files/modeles/
```
(Lancez l'application une fois avant, pour que le dossier existe.)

### Définir Jarvis comme assistant
**Paramètres > Applications > Applications par défaut > Assistant numérique** (ou « Application d'assistance »)
> choisissez **Jarvis**. Un appui long sur Accueil (ou sur Alimentation, selon le réglage du constructeur)
ouvre alors Jarvis, qui commence à écouter tout de suite.

---

## 4. Commandes disponibles

| Commande | Exemples |
|---|---|
| Recherche Google | « recherche la météo à Lyon », « cherche recette de crêpes », « qui est Marie Curie » |
| Ouvrir une appli | « ouvre YouTube », « lance l'appareil photo » |
| Appel | « appelle Maman » (avec CALL_PHONE l'appel part directement, sinon le composeur s'ouvre) |
| Minuteur | « minuteur de cinq minutes », « minuteur de deux minutes trente » |
| Réveil | « réveille-moi à sept heures trente », « alarme à 6h45 », « … à huit heures moins le quart » |
| Heure / date | « quelle heure est-il », « quel jour sommes-nous » |
| Lampe torche | « lampe torche on », « allume la lampe », « éteins la torche » |
| Aide | « qu'est-ce que tu sais faire » |
| Autre | → « Je n'ai pas compris. » |

**Ajouter une commande :** ouvrez `commandes/Commandes.kt` et ajoutez un élément `Commande(...)` à la liste.
Les regex s'appliquent au texte en minuscules **sans accents** (« réveille-moi » devient « reveille moi »),
et la fonction renvoie la phrase que Jarvis prononcera. Exemple :

```kotlin
Commande(
    nom = "Blague",
    exemples = listOf("raconte une blague"),
    motifs = listOf(Regex("\\bblague\\b")),
) { "Pourquoi les plongeurs plongent-ils en arrière ? Parce que sinon ils tombent dans le bateau." },
```

---

## 5. Limites connues et dépannage

### Consommation de batterie
- L'écoute continue maintient le micro et un cœur du processeur actifs : comptez **3 à 8 % de batterie par heure**
  selon le téléphone. Si vous désactivez le mot de réveil dans les réglages, le micro est libéré et il ne reste que le
  bouton « Parler » et l'appui long sur Accueil, ce qui ne consomme quasiment rien.
- Le bouton **Pause** de la notification libère le micro sans quitter Jarvis.
- Le point vert « micro utilisé » d'Android 12+ reste allumé pendant la veille. C'est voulu par Android et on ne
  peut pas le masquer.

### Restrictions des constructeurs
Certaines surcouches tuent les services en arrière-plan malgré la notification. Le site <https://dontkillmyapp.com>
détaille chaque marque.
- **Xiaomi / Redmi / POCO (MIUI, HyperOS) :** Paramètres > Applications > Jarvis > **Démarrage automatique : activé**,
  **Économiseur de batterie : Aucune restriction**. Dans les applis récentes, appui long sur Jarvis > 🔒 (verrouiller).
  Activez aussi « Afficher les fenêtres pop-up en arrière-plan », sans quoi les applis ne s'ouvrent pas.
- **Samsung (One UI) :** Paramètres > Batterie > Limites d'utilisation en arrière-plan : retirez Jarvis des
  « Applications en veille » et ajoutez-le aux **« Applications jamais en veille »**.
- **Huawei / Honor :** Gestionnaire de lancement d'applications > Jarvis > gestion manuelle, tout activer.
- **OnePlus / Oppo / Realme :** Batterie > Optimisation > Jarvis > « Ne pas optimiser » et autoriser l'activité en
  arrière-plan.

### Restrictions d'Android
- **Android 11+ et démarrage au boot :** un service lancé en arrière-plan n'a pas accès au micro, et Android 14 refuse
  même de le démarrer. Au boot, Jarvis affiche donc une notification « Touchez pour activer » : un seul toucher
  suffit. C'est le seul moyen conforme.
- **Ouverture d'applis depuis l'arrière-plan (Android 10+) :** si l'autorisation « affichage par-dessus » n'est pas
  accordée et que l'écran de Jarvis n'est pas visible, la commande produit une notification à toucher.
- **Micro coupé** dans les réglages rapides (Android 12+) : Jarvis passe en ERREUR « Micro coupé par Android ».
- Un autre logiciel qui monopolise le micro (appel, enregistreur, Google Assistant « Ok Google ») empêche Jarvis
  d'écouter. Désactivez « Hey Google / Voice Match » pour éviter les conflits.

### Latence et précision
| Modèle | Taille | RAM | Latence après la fin de la phrase* |
|---|---|---|---|
| Vosk small-fr 0.22 (par défaut) | 41 Mo | ~300 Mo | ~1,2 s de silence attendu + < 0,3 s |
| Vosk small-fr pguyot 0.3 | 39 Mo | ~300 Mo | identique |
| *(pour comparaison)* whisper.cpp base q5 | 60 Mo | ~400 Mo | 1 à 3 s de calcul |
| *(pour comparaison)* whisper.cpp small q5 | 190 Mo | ~800 Mo | 4 à 10 s de calcul |

\*Sur un téléphone de milieu de gamme (Snapdragon 6xx / Dimensity 7xxx). Le délai de 1,2 s de silence se règle
dans `Transcripteur.SILENCE_FIN_MS`.

### Problèmes fréquents
| Symptôme | Solution |
|---|---|
| « Jarvis » n'est jamais détecté | Augmentez la sensibilité. Dans Logcat, filtrez sur `vosk` : un message « Ignoring word missing in vocabulary » signale une variante inconnue du modèle. Ajoutez d'autres variantes (`DetecteurMotReveil.VARIANTES`), ou utilisez le bouton Parler. |
| Déclenchements intempestifs | Baissez la sensibilité sous 70 % (en dessous, la détection attend la fin du mot et vérifie la confiance). |
| Jarvis ne parle pas | Paramètres > Synthèse vocale : moteur Google, langue **Français (France)**, téléchargez la voix hors ligne. |
| Le service s'arrête après quelques minutes | Voir « Restrictions des constructeurs » ci-dessus, et l'exemption de batterie sur l'écran d'accueil. |
| Jarvis absent de la liste des assistants | Désinstallez puis réinstallez l'APK. Sur certaines surcouches, la liste se trouve sous « Saisie vocale » ou « Assistant et saisie vocale ». |
| « Ouvre X » ne trouve pas l'appli | Dites le nom affiché sous l'icône. Vosk peut mal orthographier les noms anglais. |
| La synchronisation Gradle échoue | File > Invalidate Caches > Restart. Vérifiez que *Gradle JDK* = 17 (Settings > Build > Gradle). |

---

## 6. Améliorations possibles

1. **Dictée dans n'importe quel champ (AccessibilityService)** : un service d'accessibilité repère le champ de texte
   qui a le focus (`AccessibilityNodeInfo.isEditable`) et y insère la transcription Vosk avec
   `ACTION_SET_TEXT`. On pourrait aussi exposer Vosk via `JarvisRecognitionService` pour offrir la dictée hors ligne
   à tout le système, ou écrire un `InputMethodService` (clavier vocal).
2. **Connexion au PC** : petit serveur WebSocket / HTTP sur le PC (FastAPI, en Python comme votre version Windows)
   et client OkHttp côté Android. Commandes « verrouille le PC », « lance la musique sur le PC », « envoie ce texte au
   PC ». Découverte automatique via mDNS (`NsdManager`), secret partagé pour l'authentification.
3. **Domotique** : appels REST vers **Home Assistant** (`POST /api/services/light/turn_on` avec un jeton longue durée)
   ou publication **MQTT** (Eclipse Paho). Vosk accepte une grammaire dynamique avec les noms de vos pièces et
   appareils, ce qui améliore nettement la précision.
4. **Mot de réveil dédié** : entraîner un modèle openWakeWord « Jarvis » prononcé à la française, pour réduire la
   consommation CPU de la veille.
5. **Transcription plus précise à la demande** : garder Vosk pour la veille et les commandes courtes, puis passer
   l'audio à whisper.cpp pour les dictées longues.
6. **Conversation** : enchaîner une nouvelle écoute sans redire « Jarvis » après une question, ou brancher un LLM
   local (llama.cpp, Gemma 2B) pour des réponses libres.
7. **Widget et tuile des réglages rapides** (`TileService`) pour activer/mettre en pause l'écoute d'un geste.
