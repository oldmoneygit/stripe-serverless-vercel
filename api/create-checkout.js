import Stripe from 'stripe';
import getRawBody from 'raw-body';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2022-11-15',
});

// 🔧 Headers CORS
function setCorsHeaders(res) {
  try {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Permitir qualquer origem (ajuste conforme necessário)
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization'
    );
  } catch (e) {
    console.error('❌ Falha ao setar CORS headers:', e.message);
  }
}

// 🧠 Validação básica
function validarItems(items) {
  return Array.isArray(items) && items.length > 0 && items.every(item =>
    item && typeof item === 'object' &&
    typeof item.price === 'number' &&
    typeof item.quantity === 'number'
  );
}

// 🧨 Handler Principal
export default async function handler(req, res) {
  console.log('\n🔥 [API] /api/create-checkout chamada!');

  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    console.log('🔁 [OPTIONS] CORS liberado.');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    console.warn(`❌ [ERRO] Método ${req.method} não permitido.`);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const raw = await getRawBody(req);
    const body = JSON.parse(raw.toString());

    console.log('📦 [REQUEST] Body recebido:', body);

    const { items } = body;

    if (!validarItems(items)) {
      console.warn('❌ [ERRO] Carrinho inválido ou vazio:', items);
      return res.status(400).json({ error: 'Carrinho inválido ou vazio.' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map(item => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'SNEAKER SNK HOUSE', // Nome do produto
          },
          unit_amount: Math.round(item.price * 100), // Certifique-se de que o valor está em centavos
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${process.env.SUCCESS_URL || 'https://602j2f-ig.myshopify.com/pages/obrigado'}`,
      cancel_url: `${process.env.CANCEL_URL || 'https://602j2f-ig.myshopify.com/pages/erro'}`,
      billing_address_collection: 'auto',
      shipping_address_collection: {
        allowed_countries: ['ES'],
      },
      phone_number_collection: {
        enabled: true,
      },
      locale: 'es',
      metadata: {
        items: JSON.stringify(items),
      },
    });

    console.log('✅ [STRIPE] Sessão criada:', session.id);
    res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('💥 [FATAL] Stripe explodiu:', err.message || err);
    res.status(500).json({ error: err.message || 'Erro interno no servidor' });
  }
}