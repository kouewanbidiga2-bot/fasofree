/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable } from '@nestjs/common';

const CONTRACT = 'koliwa-delivery-v1';
const DEFAULT_SUGGESTIONS = [
  'Comment envoyer un colis ?',
  'Comment faire récupérer un achat ?',
  'Comment suivre un colis ?',
  'Comment connaître le prix ?',
];

type ActionId = 'send' | 'pickup' | 'track' | 'history' | 'support' | 'signup' | 'login';
type AssistantAction = { id: ActionId; reference?: string };
const DEFAULT_ACTIONS: ActionId[] = ['send', 'pickup', 'track', 'support'];

interface Guidance {
  intent: string;
  match: RegExp;
  answer: string;
  actions: ActionId[];
}

const GUIDANCE: Guidance[] = [
  {
    intent: 'password',
    match: /\b(mot de passe|me connecter|connexion)\b/,
    answer: 'Ouvrez Connexion avec votre numéro de téléphone ou votre adresse e-mail. Pour réinitialiser votre accès, utilisez le lien Mot de passe oublié.',
    actions: ['login'],
  },
  {
    intent: 'receipt',
    match: /\b(pin|code (?:de )?(?:reception|remise)|confirmer la reception|confirme.*reception)\b/,
    answer: 'Le destinataire ouvre le lien de suivi partagé et utilise son code PIN au moment de recevoir le colis. Le bouton de confirmation s’affiche lorsque le coursier a signalé son arrivée.',
    actions: ['track'],
  },
  {
    intent: 'issue',
    match: /\b(litige|reclamation|support|assistance|remboursement|bloqu\w*|retard|perdu|abime|annul\w*|probleme|echec|echou\w*|double debit)\b/,
    answer: 'Ouvrez vos livraisons ou l’espace Litiges pour signaler le problème. Indiquez la référence Koliwa et ce qui s’est passé. L’équipe pourra examiner le dossier.',
    actions: ['history', 'support'],
  },
  {
    intent: 'partner',
    match: /\b(devenir (?:coursier|livreur|partenaire|marchand)|postuler|candidature|flotte|societe de livraison|documents? (?:kyc|kyb)|kyc|kyb)\b/,
    answer: 'Ouvrez l’inscription et choisissez le profil correspondant à votre activité. Déposez les justificatifs demandés. L’équipe Koliwa examine votre dossier avant d’activer votre accès.',
    actions: ['signup'],
  },
  {
    intent: 'history',
    match: /\b(historique|mes (?:livraisons|envois|colis|commandes)|anciens? (?:colis|envois))\b/,
    answer: 'Connectez-vous puis ouvrez Mes livraisons. Vous y retrouvez vos envois en cours et vos anciennes livraisons.',
    actions: ['history'],
  },
  {
    intent: 'tracking',
    match: /\b(suiv\w*|statut|position|ou (?:est|en est|se trouve)|reference|numero de livraison)\b/,
    answer: 'Ouvrez Suivi et saisissez la référence Koliwa indiquée sur le récapitulatif. Si vous êtes le destinataire, vous pouvez aussi ouvrir le lien que l’expéditeur vous a partagé.',
    actions: ['track'],
  },
  {
    intent: 'price',
    match: /\b(tarif|prix|combien|cout|coute|estimation|devis|frais)\b/,
    answer: 'Indiquez le départ, l’arrivée et les caractéristiques du colis. Koliwa affiche une estimation dans le formulaire avant que vous confirmiez la demande.',
    actions: ['send', 'pickup'],
  },
  {
    intent: 'payment',
    match: /\b(payer|paiement|debite|orange money|moov money|mobile money|wave|especes|cash)\b/,
    answer: 'Une fois la demande confirmée, ouvrez le paiement Koliwa et choisissez parmi les moyens affichés. Vous pouvez consulter l’état de la livraison dans Mes livraisons.',
    actions: ['send', 'history'],
  },
  {
    intent: 'pickup',
    match: /\b(recuper\w*|retrait|retirer|chez (?:un|le) (?:commercant|vendeur))\b/,
    answer: 'Choisissez le retrait en boutique si votre achat ou votre repas est déjà payé. Indiquez le nom du commerce, son adresse ou son repère, le contact sur place et l’adresse de remise.',
    actions: ['pickup'],
  },
  {
    intent: 'meal',
    match: /\b(command(?:er|e) (?:un |des |de )?(?:repas|plat\w*)|menu|restaurant|manger)\b/,
    answer: 'Commandez et payez votre repas auprès du commerce. Si vous souhaitez qu’un coursier le récupère pour vous, ouvrez Retrait en boutique.',
    actions: ['pickup'],
  },
  {
    intent: 'delivery',
    match: /\b(envoy\w*|expedi\w*|ramass\w*|colis|livraison|livrer)\b/,
    answer: 'Choisissez Envoyer un colis. Indiquez les lieux de départ et d’arrivée, les contacts sur place et la description du colis. Vous pourrez vérifier le tarif avant de confirmer.',
    actions: ['send'],
  },
  {
    intent: 'account',
    match: /\b(inscri\w*|compte)\b/,
    answer: 'Ouvrez l’inscription et choisissez Client pour créer votre compte. Si vous avez déjà un compte, ouvrez Connexion.',
    actions: ['signup', 'login'],
  },
];

const TRACKING_REFERENCE = /\bKW(?:[\s-]?[0-9A-F]{4}){5}\b/i;
const FALLBACK = 'Choisissez un envoi, un retrait en boutique ou un suivi. Pour un problème sur une livraison, ouvrez l’espace Litiges.';

@Injectable()
export class AssistantService {
  meta() {
    return { name: 'Assistant Koliwa', lang: 'fr', contract: CONTRACT, suggestions: DEFAULT_SUGGESTIONS };
  }

  ask(question: string) {
    const normalized = question
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['’]/g, ' ');
    const guidance = GUIDANCE.find(({ match }) => match.test(normalized));
    const reference = question.match(TRACKING_REFERENCE)?.[0].replace(/[\s-]/g, '').slice(2).toUpperCase();
    const canTrack = reference && (!guidance || guidance.intent === 'tracking' || guidance.intent === 'delivery');
    const actions: AssistantAction[] = canTrack
      ? [{ id: 'track', reference }]
      : (guidance?.actions ?? DEFAULT_ACTIONS).map((id) => ({ id }));

    return {
      contract: CONTRACT,
      intent: canTrack ? 'tracking' : guidance?.intent ?? 'fallback',
      answer: canTrack
        ? 'J’ai repéré votre référence. Ouvrez le suivi pour consulter le statut actuel de cette livraison.'
        : guidance?.answer ?? FALLBACK,
      actions,
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  voiceAction(question: string) {
    const response = this.ask(question);
    return { ...response, action: 'none', query: '', message: response.answer };
  }
}
