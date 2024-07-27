// netlify/functions/fetchTokenPrices.js

const fetch = require('node-fetch');

const fetchTokenPrices = async (tokenAddresses) => {
  const url = `https://api.coingecko.com/api/v3/simple/token_price/binance-smart-chain?vs_currencies=usd&contract_addresses=${tokenAddresses.join(",")}`;
  const response = await fetch(url);
  const data = await response.json();
  const prices = {};
  for (const address of tokenAddresses) {
    prices[address] = data[address.toLowerCase()]?.usd || 0;
  }
  return prices;
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const { tokenAddresses } = JSON.parse(event.body);

  if (!Array.isArray(tokenAddresses)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid token addresses' }),
    };
  }

  try {
    const prices = await fetchTokenPrices(tokenAddresses);
    return {
      statusCode: 200,
      body: JSON.stringify(prices),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch token prices' }),
    };
  }
};
