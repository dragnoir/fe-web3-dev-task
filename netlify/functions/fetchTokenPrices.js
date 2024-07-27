const fetch = require('node-fetch');

const fetchTokenPrice = async (tokenAddress) => {
  const url = `https://api.coingecko.com/api/v3/simple/token_price/binance-smart-chain?vs_currencies=usd&contract_addresses=${tokenAddress}`;
  const response = await fetch(url);
  const data = await response.json();
  const price = data[tokenAddress.toLowerCase()]?.usd || 0;
  return price;
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const { tokenAddress } = JSON.parse(event.body);

  if (typeof tokenAddress !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid token address' }),
    };
  }

  try {
    const price = await fetchTokenPrice(tokenAddress);
    return {
      statusCode: 200,
      body: JSON.stringify({ [tokenAddress]: price }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch token price' }),
    };
  }
};
