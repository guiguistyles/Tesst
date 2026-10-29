# Règles utiles uniquement si vous activez isMinifyEnabled en release.
# JNA et Vosk accèdent aux classes par réflexion : on les conserve intégralement.
-keep class com.sun.jna.** { *; }
-keep class * implements com.sun.jna.** { *; }
-keep class org.vosk.** { *; }
-dontwarn java.awt.**
