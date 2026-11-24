// Ce qui sort de l'API : jamais de mot de passe, jamais de lien payant sans droit d'accès.

/** Profil de l'utilisateur connecté (ou vu par un admin). */
const userOut = (u) => ({
  id: u.id,
  number: u.number,
  email: u.email,
  name: u.name,
  tel: u.tel,
  country: u.country,
  role: u.role,
  isVerified: u.is_verified,
  emailOptIn: u.email_opt_in,
  smsOptIn: u.sms_opt_in,
  createdAt: u.created_at,
});

/** Participant à un contenu (vue admin) : uniquement le nécessaire. */
const participantOut = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  tel: u.tel,
  country: u.country,
  enrolledAt: u.enrolled_at,
  source: u.source,
});

/**
 * Contenu. `hasAccess` dit si la personne qui regarde peut ouvrir le lien.
 * Le lien (`url`) n'est inclus que si elle y a droit.
 */
const contentOut = (c, { hasAccess = false, isAdmin = false } = {}) => {
  const free = Number(c.price) <= 0;
  const access = isAdmin || free || hasAccess;
  return {
    id: c.id,
    number: c.number,
    type: c.type,
    title: c.title,
    description: c.description,
    price: Number(c.price),
    isFree: free,
    posterUrl: c.poster_url,
    createdAt: c.created_at,
    hasAccess: access,
    url: access ? c.url : null,
  };
};

const paymentOut = (p) => ({
  id: p.id,
  contentId: p.content_id,
  donationKind: p.donation_kind ?? null,
  amount: Number(p.amount),
  currency: p.currency,
  status: p.status,
  message: p.message,
  createdAt: p.created_at,
});

module.exports = { userOut, participantOut, contentOut, paymentOut };
