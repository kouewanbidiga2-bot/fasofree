import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'guerrillamail.net',
  'mailinator.com', 'yopmail.com', 'yopmail.fr', 'trashmail.com', 'trashmail.net',
  'fakeinbox.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'dispostable.com', '10minutemail.com', 'maildrop.cc', 'temp-mail.org',
  'tempmailo.com', 'mohmal.com', 'burnermail.io', 'tmpmail.net',
  'emailondeck.com', '33mail.com', 'mytemp.email', 'discard.email',
  'discardmail.com', 'mailnesia.com', 'tempinbox.com', 'tempail.com',
  'tempr.email', 'getnada.com', 'emailfake.com', 'meltmail.com',
  'nospam.ze.tc', 'nomail.xl.cx', 'discardmail.de', 'mailexpire.com',
  'mailnull.com', 'mailshell.com', 'mailsiphon.com', 'mailspan.net',
  'mailtothis.com', 'meokat.com', 'moody.mx', 'nospamfor.us',
  'nowmymail.com', 'owlymail.com', 'proxymail.eu', 'rcpt.at',
  'reallymymail.com', 'rppkn.com', 'rtrtr.com', 'safersignup.de',
  'safetymail.info', 'sandelf.de', 'saynotospams.com', 'scatmail.com',
  'schafmail.de', 'schrott-email.de', 'secretemail.de', 'sibmail.com',
  'sinnlos-mail.de', 'slaskpost.se', 'slopsbox.com', 'slowslow.de',
  'smashmail.de', 'smtp.de', 'snkmail.com', 'sofimail.com',
  'sofort-mail.de', 'sogetthis.com', 'soodonims.com', 'spam.la',
  'spam.su', 'spam4.me', 'spamavert.com', 'spambob.com',
  'spambob.net', 'spambob.org', 'spambog.com', 'spambog.de',
  'spambog.ru', 'spambox.info', 'spambox.us', 'spamcannon.com',
  'spamcannon.net', 'spamcero.com', 'spamcorptastic.com', 'spamcowboy.com',
  'spamcowboy.net', 'spamcowboy.org', 'spamday.com', 'spamex.com',
  'spamfighter.cf', 'spamfighter.ga', 'spamfighter.gq', 'spamfighter.ml',
  'spamfighter.tk', 'spamfree.eu', 'spamfree24.com', 'spamfree24.de',
  'spamfree24.eu', 'spamfree24.info', 'spamfree24.net', 'spamfree24.org',
  'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org', 'spamherelots.com',
  'spamhereplease.com', 'spamhole.com', 'spamify.com', 'spaminator.de',
  'spamkill.info', 'spaml.com', 'spaml.de', 'spammotel.com',
  'spamobox.com', 'spamoff.de', 'spamslicer.com', 'spamspot.com',
  'spamstack.net', 'spamthis.co.uk', 'spamthisplease.com', 'spamtrail.com',
  'spamtrap.ro', 'speed.1s.fr', 'superrito.com', 'supermailer.jp',
  'superriddle.com', 'sutra.de', 'tagyoureit.com', 'talkinator.com',
  'tapchicuoihoi.com', 'teewars.org', 'teleworm.com', 'teleworm.us',
  'temp-email.org', 'temp-email.zone', 'temp-inbox.com', 'temp-mail.io',
  'temp-mail.ru', 'temp-mail.uk', 'temp-mail.win', 'temp.today',
  'tempalias.com', 'tempe11.com', 'tempemail.biz', 'tempemail.co.za',
  'tempemail.com', 'tempemail.net', 'tempget.com', 'tempguest.com',
  'tempinbox.co.uk', 'tempmail.eu', 'tempmail.it', 'tempmail2.com',
  'tempmaildemo.com', 'tempmailer.com', 'tempmailer.de', 'tempomail.fr',
  'temporarily.de', 'temporario.com', 'temporario.com.br', 'temporaryemail.net',
  'temporaryemail.us', 'temporaryforwarding.com', 'temporaryinbox.com',
  'temporarymailaddress.com', 'tempthe.net', 'thankyou2010.com', 'thc.st',
  'thecloudindex.com', 'thetempmail.com', 'throwawayemailaddress.com',
  'tittbit.in', 'tizi.com', 'tmailinator.com', 'toiea.com',
  'toomail.biz', 'topranklist.com', 'tradermail.info', 'trash-amil.com',
  'trash-mail.at', 'trash-mail.com', 'trash-mail.de', 'trash-me.com',
  'trash2009.com', 'trashdevil.com', 'trashdevil.de', 'trashemail.de',
  'trashmail.at', 'trashmail.me', 'trashmail.org', 'trashmail.ws',
  'trashmailer.com', 'trashmailer.net', 'trashymail.com', 'trashymail.net',
  'trialmail.de', 'trbvm.com', 'trbvn.com', 'tricia73.com',
  'turual.com', 'twinmail.de', 'tyldd.com', 'uggsrock.com',
  'umail.net', 'upliftnow.com', 'uplipht.com', 'venompen.com',
  'veryreally.com', 'viditag.com', 'viewcastmedia.com', 'viewcastmedia.net',
  'viewcastmedia.org', 'vomoto.com', 'vpn.st', 'vsimcard.com',
  'vubby.com', 'wasteland.rfc822.org', 'webemail.me', 'weg-werf-email.de',
  'wegwerfadresse.de', 'wegwerfemail.com', 'wegwerfemail.de', 'wegwerfmail.de',
  'wegwerfmail.net', 'wegwerfmail.org', 'wh4f.org', 'whatiaas.com',
  'whatpaas.com', 'whyspam.me', 'wickmail.net', 'wilemail.com',
  'willhackforfood.biz', 'willselfdestruct.com', 'winemaven.info',
  'wronghead.com', 'wuzup.net', 'wuzupmail.net', 'wwwnew.eu',
  'xagloo.com', 'xemaps.com', 'xents.com', 'xjoi.com',
  'xmaily.com', 'xoxy.net', 'yapped.net', 'yeah.net',
  'yep.it', 'yomail.info', 'yomail.org', 'yuurok.com',
  'zehnminutenmail.de', '1zhuan.com', '2prong.com', '30minutemail.com',
  '3d-painting.com', '4warding.com', '4warding.net', '4warding.org',
  '60minutemail.com', '675hosting.com', '675hosting.net', '675hosting.org',
  '6url.com', '75hosting.com', '75hosting.net', '75hosting.org',
  '7tags.com', '9ox.net', 'a-bc.net', 'afrobacon.com',
  'agedmail.com', 'ajaxapp.net', 'alivance.com', 'amilegit.com',
  'amiri.net', 'anappthat.com', 'ano-mail.net', 'anonbox.net',
  'anonymbox.com', 'antichef.com', 'antichef.net', 'antispam.de',
  'antispammail.de', 'armyspy.com', 'artman-conception.com', 'azmeil.tk',
]);

@ValidatorConstraint({ name: 'IsDisposableEmail', async: false })
export class IsDisposableEmailConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (!value) return false;
    const domain = value.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    return !DISPOSABLE_DOMAINS.has(domain);
  }

  defaultMessage(): string {
    return 'Les adresses email temporaires/jetables ne sont pas autorisées. Veuillez utiliser une adresse email permanente.';
  }
}

export function IsDisposableEmail(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'IsDisposableEmail',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsDisposableEmailConstraint,
    });
  };
}
