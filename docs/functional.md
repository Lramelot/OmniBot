# Fonctionnement du bot

Documentation du comportement visible par les utilisateurs et administrateurs de serveur Discord.

---

## Module Core

Toujours actif, non désinstallable. Fournit la gestion des modules pour les administrateurs.

### `/modules` — Gérer les modules du serveur

**Permission requise :** Administrateur

Affiche la liste de tous les modules disponibles avec leur statut sur le serveur (activé/désactivé), leur version activée, et leur description. Chaque module dispose d'un bouton **Activer** (vert) ou **Désactiver** (rouge) qui prend effet immédiatement.

### `/config` — Réinitialiser des champs

En bas du panneau `/config` d'un module, un bouton **Réinitialiser…** ouvre un sélecteur (éphémère, visible de l'administrateur seul) listant les champs actuellement personnalisés, plus une entrée **Tous les champs**. Les champs choisis sont remis à leur valeur par défaut.

Le bouton est désactivé tant qu'aucun champ n'a été personnalisé (rien à réinitialiser). Réinitialiser un champ retire simplement la valeur enregistrée : il repasse sur le défaut (qui suit alors de nouveau la langue du serveur, cf. plus bas) et son marqueur _(par défaut)_ réapparaît.

---

## Module Jeu des 4h

Repris du bot DJ4H. Dans le salon de jeu, le dernier message posté « tient » : si personne d'autre n'écrit pendant le délai configuré (4 h par défaut), son auteur marque un point au message suivant.

### Comportement automatique

À chaque message posté dans le salon configuré :

1. Si c'est le premier message suivi, il devient le dernier message, sans point.
2. S'il vient de l'auteur du dernier message, il est ignoré : le dernier message ne change pas, et un joueur ne peut donc pas relancer son propre délai.
3. Si le délai s'est écoulé depuis le dernier message, **l'auteur du dernier message** marque un point ; le bot l'annonce dans le salon avec son nouveau total.
4. Dans tous les autres cas, le nouveau message devient le dernier message.

Les messages de bots, les messages système (arrivée d'un membre, épinglage, boost…), les messages hors du salon (y compris dans ses fils) et les messages privés sont ignorés. Un message plus ancien que le dernier message enregistré (reçu dans le désordre) est ignoré lui aussi. Après un changement de salon de jeu, le dernier message de l'ancien salon ne compte plus : la partie repart du premier message posté dans le nouveau. Il en va de même quand le module est réactivé après avoir été désactivé.

Un message supprimé ne compte plus : si c'était le dernier message, c'est le message de joueur précédent encore présent dans le salon qui redevient le dernier message, avec son heure d'envoi réelle. Si le salon n'en contient plus, la partie repart du prochain message.

Au démarrage, le bot relit le vrai dernier message de joueur de chaque salon de jeu pour rattraper les messages postés ou supprimés pendant qu'il était arrêté. Les points qui auraient dû être gagnés pendant l'arrêt ne sont pas rattrapés. Les messages d'un même serveur sont traités un par un : deux messages simultanés ne peuvent pas marquer deux fois sur le même prédécesseur.

### `/jd4h score [member]`

Affiche le score du membre indiqué, ou le sien par défaut.

### `/jd4h leaderboard`

Génère une image du top 10 du serveur (rang, médailles pour le podium, avatar, pseudo, score). Les membres à 0 point et ceux dont le compte Discord est introuvable n'y figurent pas. L'image est réutilisée pendant 15 secondes par serveur et par langue, et régénérée dès qu'un score change.

### `/jd4h-admin set <member> <score>` et `/jd4h-admin unset <member>`

**Permission requise :** Administrateur

Fixe le score d'un membre, ou le supprime. Fixer un score à 0 revient à le supprimer. Réponses éphémères.

### Configuration — `/config four-hour-game`

| Champ     | Type  | Description                                                                               |
| --------- | ----- | ----------------------------------------------------------------------------------------- |
| `channel` | Salon | Salon du jeu. Tant qu'il n'est pas défini, le module ne fait rien.                        |
| `delay`   | Durée | Délai pour marquer un point, saisi comme `30s`, `5m`, `4h`, `1h30m`, `3d`. Défaut : `4h`. |

---

## Module Anniversaires

Les membres enregistrent leur date d'anniversaire (jour et mois, sans année) ; le jour venu, le bot le leur souhaite dans le salon configuré et peut leur attribuer un rôle pour la journée.

### Comportement automatique

Le bot vérifie les anniversaires à chaque quart d'heure (:00, :15, :30, :45), dans le fuseau horaire du serveur — tous les fuseaux étant décalés d'un multiple de 15 minutes, chaque heure d'annonce et chaque minuit local tombent sur une vérification. Il vérifie aussi le serveur dès qu'un anniversaire est enregistré. Dès que l'heure d'annonce est atteinte le jour de l'anniversaire, il :

1. attribue le rôle d'anniversaire à chaque membre fêté, si un rôle est configuré ;
2. publie **un seul** message d'annonce dans le salon configuré, qui mentionne tous les membres fêtés à ce moment-là (« @Alice et @Bob »).

Un membre n'est fêté qu'une fois par an, même si le bot redémarre ou si sa date est modifiée. Un anniversaire enregistré le jour même, après l'heure d'annonce, est fêté aussitôt. Si le bot était arrêté pendant toute la journée, l'anniversaire n'est pas rattrapé. Les membres nés un 29 février sont fêtés le 28 février les années non bissextiles.

Un membre qui a quitté le serveur n'est pas fêté : son anniversaire est supprimé dès que le bot constate son départ (au moment de le fêter, de lui retirer le rôle ou en affichant `/birthday upcoming`).

Le rôle est retiré dès que la journée est terminée, quand le membre supprime son anniversaire, et à la désactivation du module. Le bot retire le rôle qu'il a réellement attribué : si le rôle configuré change dans la journée, l'ancien est retiré et le nouveau attribué ; si le champ est vidé, le rôle est simplement retiré. Le bot a besoin de la permission _Gérer les rôles_ et que son rôle soit placé au-dessus du rôle d'anniversaire.

### `/birthday set <day> <month>` et `/birthday remove`

Enregistre ou oublie son propre anniversaire. Une date inexistante (31 avril…) est refusée. Réponses éphémères.

### `/birthday show [member]`

Affiche l'anniversaire du membre indiqué, ou le sien par défaut.

### `/birthday upcoming`

Liste les 10 prochains anniversaires du serveur, avec le nombre de jours restants. Si le fuseau horaire configuré est invalide, un avertissement s'affiche en pied de liste.

### `/birthday-admin set <member> <day> <month>` et `/birthday-admin remove <member>`

**Permission requise :** Administrateur

Fixe ou supprime l'anniversaire d'un membre. Réponses éphémères ; celle de `set` signale un fuseau horaire invalide.

### Configuration — `/config birthday`

| Champ      | Type  | Description                                                                                                   |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| `channel`  | Salon | Salon des annonces. S'il n'est pas défini, aucun message n'est publié (le rôle reste attribué).               |
| `role`     | Rôle  | Rôle attribué pendant la journée d'anniversaire. Facultatif.                                                  |
| `message`  | Texte | Message d'annonce ; `{user}` est remplacé par les mentions des membres fêtés. Défaut traduit selon la langue. |
| `hour`     | Choix | Heure d'annonce, de `00:00` à `23:00`. Défaut : `09:00`.                                                      |
| `timezone` | Texte | Fuseau horaire IANA (`Europe/Paris`, `America/Montreal`…). Défaut : `Europe/Paris`, UTC si invalide.          |

---

## Module Thread Creator

Crée automatiquement un fil de discussion sous chaque nouveau message dans un salon configuré. Remplace le bot Needle.

### Comportement automatique

Dès qu'un message est posté dans le salon configuré :

1. Le bot crée un fil dont le nom est généré depuis le template configuré
2. Si un message de bienvenue est configuré, le bot le poste dans le fil

**Variables disponibles dans le template de nom :**

| Variable           | Valeur                                           |
| ------------------ | ------------------------------------------------ |
| `{messageAuthor}`  | Nom d'affichage ou pseudo de l'auteur            |
| `{messageContent}` | 50 premiers caractères du message                |
| `{timestamp}`      | Heure au format `JJ/MM HH:MM` (locale française) |

**Template par défaut :** `Discussion - {messageAuthor}`  
**Message de bienvenue par défaut :** `💬 Utilisez ce fil pour discuter de ce sujet !`

> [!NOTE]
> Les valeurs par défaut suivent la langue du serveur (`/config core`) : tant
> qu'un administrateur n'a pas saisi sa propre valeur, le message de bienvenue
> par défaut s'affiche dans la langue configurée et change si on bascule la
> langue. Dès qu'une valeur est définie manuellement, elle est figée et
> n'est plus affectée par la langue. Dans `/config`, une valeur encore par
> défaut est signalée par le marqueur _(par défaut)_, ce qui permet de voir
> d'un coup d'œil ce qui a réellement été configuré.

**Limites :**

- Noms de fils tronqués à 100 caractères (limite Discord)
- Rate limit : 5 fils max par fenêtre de 10 secondes par serveur — les créations excédentaires sont **mises en file d'attente** (FIFO, par serveur) et traitées dès que la fenêtre se libère, au lieu d'être ignorées. File en mémoire : perdue au redémarrage.
- Messages de bots ignorés
- Ne fonctionne pas dans les fils, salons vocaux, forum ou annonces

**Erreurs gérées silencieusement :**

- Message supprimé avant création du fil
- Limite de fils atteinte sur le salon
- Permissions insuffisantes

### Configuration — `/config thread-creator`

Depuis la v2.0.0, le module utilise le système de configuration générique. Il n'a
plus de commande dédiée : la configuration se fait via `/config thread-creator`
(réservé aux administrateurs) et l'activation/désactivation via `/modules`.

| Champ                | Type           | Description                                                                                  |
| -------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `channels`           | Salons (liste) | Salons à surveiller (un ou plusieurs, multi-select). Liste vide = rien n'est surveillé.      |
| `welcomeMessage`     | Texte          | Message posté automatiquement dans chaque fil créé.                                          |
| `threadNameTemplate` | Texte          | Template du nom des fils — variables : `{messageAuthor}`, `{messageContent}`, `{timestamp}`. |

Il n'y a plus de flag `actif` : désactiver le module via `/modules` arrête la
surveillance sans effacer la configuration.
