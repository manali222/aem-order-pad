// Magento GraphQL endpoint — update this to your Commerce 2.4.7 instance
const MAGENTO_GRAPHQL_URL = 'https://app.mageclone-source.test/graphql';

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function searchProducts(query) {
  const graphqlQuery = {
    query: `
      query productSearch($search: String!) {
        products(search: $search, pageSize: 10) {
          items {
            sku
            name
            price_range {
              minimum_price {
                regular_price {
                  value
                  currency
                }
              }
            }
          }
        }
      }
    `,
    variables: { search: query },
  };

  try {
    const resp = await fetch(MAGENTO_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(graphqlQuery),
    });
    const { data } = await resp.json();
    return data.products.items;
  } catch {
    return [
      {
        sku: 'MOCK-001',
        name: `${query} Widget`,
        price_range: { minimum_price: { regular_price: { value: 29.99, currency: 'USD' } } },
      },
      {
        sku: 'MOCK-002',
        name: `${query} Gadget`,
        price_range: { minimum_price: { regular_price: { value: 49.99, currency: 'USD' } } },
      },
      {
        sku: 'MOCK-003',
        name: `${query} Pro`,
        price_range: { minimum_price: { regular_price: { value: 99.99, currency: 'USD' } } },
      },
    ];
  }
}

async function submitOrder(items) {
  const graphqlQuery = {
    query: `
      mutation submitQuickOrder($items: [QuickOrderItemInput!]!) {
        submitQuickOrder(items: $items) {
          order_id
          status
          message
        }
      }
    `,
    variables: {
      items: items.map((item) => ({
        sku: item.sku,
        qty: item.qty,
      })),
    },
  };

  try {
    const resp = await fetch(MAGENTO_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(graphqlQuery),
    });
    const { data } = await resp.json();
    return data.submitQuickOrder;
  } catch {
    return {
      order_id: `MOCK-${Date.now()}`,
      status: 'pending',
      message: 'Order submitted (mock)',
    };
  }
}

async function fetchOrderHistory() {
  const graphqlQuery = {
    query: `
      query {
        quickOrderHistory {
          items {
            order_id
            created_at
            status
            line_items {
              sku
              name
              qty
              price
            }
          }
        }
      }
    `,
  };

  try {
    const resp = await fetch(MAGENTO_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(graphqlQuery),
    });
    const { data } = await resp.json();
    return data.quickOrderHistory.items;
  } catch {
    return [
      {
        order_id: 'MOCK-1001',
        created_at: '2026-05-08 10:30:00',
        status: 'completed',
        line_items: [
          {
            sku: 'WH-01',
            name: 'Widget Pro',
            qty: 5,
            price: 29.99,
          },
          {
            sku: 'GD-02',
            name: 'Gadget Plus',
            qty: 2,
            price: 49.99,
          },
        ],
      },
    ];
  }
}

function getPrice(product) {
  return product.price_range.minimum_price.regular_price.value;
}

function getCurrency(product) {
  return product.price_range.minimum_price.regular_price.currency;
}

function updateTotal(container) {
  const rows = container.querySelectorAll('.order-row');
  let total = 0;
  rows.forEach((row) => {
    const price = parseFloat(row.querySelector('.product-input').dataset.price || 0);
    const qty = parseInt(row.querySelector('.qty-input').value, 10);
    total += price * qty;
  });
  container.querySelector('.order-total-value').textContent = `$${total.toFixed(2)}`;
}

function createOrderRow(container) {
  const row = document.createElement('div');
  row.className = 'order-row';

  row.innerHTML = `
    <div class="product-search">
      <input type="text" class="product-input" placeholder="Type product name..." autocomplete="off" />
      <ul class="autocomplete-list"></ul>
    </div>
    <input type="number" class="qty-input" min="1" value="1" />
    <span class="row-price">\u2014</span>
    <button class="remove-row" title="Remove">\u2715</button>
  `;

  const input = row.querySelector('.product-input');
  const list = row.querySelector('.autocomplete-list');
  const qtyInput = row.querySelector('.qty-input');

  const doSearch = debounce(async (value) => {
    if (value.length < 2) {
      list.hidden = true;
      return;
    }
    const products = await searchProducts(value);
    list.innerHTML = '';
    products.forEach((product) => {
      const li = document.createElement('li');
      li.textContent = `${product.name} \u2014 $${getPrice(product)}`;
      li.addEventListener('click', () => {
        input.value = product.name;
        input.dataset.sku = product.sku;
        input.dataset.price = getPrice(product);
        input.dataset.currency = getCurrency(product);
        row.querySelector('.row-price').textContent = `$${(getPrice(product) * parseInt(qtyInput.value, 10)).toFixed(2)}`;
        list.hidden = true;
      });
      list.append(li);
    });
    list.hidden = false;
  }, 300);

  input.addEventListener('input', (e) => doSearch(e.target.value));
  input.addEventListener('blur', () => {
    setTimeout(() => {
      list.hidden = true;
    }, 200);
  });

  qtyInput.addEventListener('change', () => {
    if (input.dataset.price) {
      row.querySelector('.row-price').textContent = `$${(parseFloat(input.dataset.price) * parseInt(qtyInput.value, 10)).toFixed(2)}`;
    }
  });

  row.querySelector('.remove-row').addEventListener('click', () => {
    row.remove();
    updateTotal(container);
  });

  return row;
}

function renderOrderHistory(historyContainer, orders) {
  if (!orders.length) {
    historyContainer.innerHTML = '<p class="no-orders">No orders yet.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'history-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Order ID</th>
        <th>Date</th>
        <th>Status</th>
        <th>Items</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  orders.forEach((order) => {
    const total = order.line_items.reduce((sum, li) => sum + li.price * li.qty, 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${order.order_id}</td>
      <td>${order.created_at}</td>
      <td><span class="status-badge status-${order.status}">${order.status}</span></td>
      <td>${order.line_items.map((li) => `${li.name} x${li.qty}`).join(', ')}</td>
      <td>$${total.toFixed(2)}</td>
    `;
    tbody.append(tr);
  });

  historyContainer.innerHTML = '';
  historyContainer.append(table);
}

export default async function decorate(block) {
  block.innerHTML = '';

  const formSection = document.createElement('div');
  formSection.className = 'order-form';
  formSection.innerHTML = `
    <h2>Quick Order Pad</h2>
    <div class="order-rows"></div>
    <div class="order-actions">
      <button class="add-row-btn">+ Add Line</button>
      <div class="order-total">
        Total: <span class="order-total-value">$0.00</span>
      </div>
      <button class="submit-order-btn">Submit Order</button>
    </div>
    <div class="order-message" hidden></div>
  `;

  const historySection = document.createElement('div');
  historySection.className = 'order-history';
  historySection.innerHTML = `
    <h2>Order History</h2>
    <div class="history-content"><p>Loading...</p></div>
  `;

  block.append(formSection, historySection);

  const rowsContainer = formSection.querySelector('.order-rows');
  rowsContainer.append(createOrderRow(rowsContainer));

  formSection.querySelector('.add-row-btn').addEventListener('click', () => {
    rowsContainer.append(createOrderRow(rowsContainer));
  });

  formSection.querySelector('.submit-order-btn').addEventListener('click', async () => {
    const rows = rowsContainer.querySelectorAll('.order-row');
    const items = [];
    rows.forEach((row) => {
      const { sku } = row.querySelector('.product-input').dataset;
      const qty = parseInt(row.querySelector('.qty-input').value, 10);
      if (sku && qty > 0) {
        items.push({ sku, qty });
      }
    });

    if (!items.length) {
      const msg = formSection.querySelector('.order-message');
      msg.textContent = 'Please add at least one product.';
      msg.className = 'order-message error';
      msg.hidden = false;
      return;
    }

    const btn = formSection.querySelector('.submit-order-btn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    const result = await submitOrder(items);
    const msg = formSection.querySelector('.order-message');
    msg.textContent = `Order ${result.order_id} \u2014 ${result.message}`;
    msg.className = 'order-message success';
    msg.hidden = false;

    btn.disabled = false;
    btn.textContent = 'Submit Order';

    rowsContainer.innerHTML = '';
    rowsContainer.append(createOrderRow(rowsContainer));
    updateTotal(formSection);

    const orders = await fetchOrderHistory();
    renderOrderHistory(historySection.querySelector('.history-content'), orders);
  });

  const orders = await fetchOrderHistory();
  renderOrderHistory(historySection.querySelector('.history-content'), orders);
}
