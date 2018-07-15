/*
Copyright 2016 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import sendToServer from 'merchant-server';

const SHIPPING_OPTIONS = {
  us: [
    {
      id: 'standard',
      label: 'Standard Shipping',
      price: 0
    },
    {
      id: 'express',
      label: 'Express Shipping',
      price: 10
    }
  ],
  international: [
    {
      id: 'international',
      label: 'International Shipping',
      price: 15
    }
  ]
};

export default class PaymentAPIWrapper {

  /*
  * Given a cart set up with an order, gets payment authorization.
  * Returns a promise that resolves when payment is complete, this
  * has a data object you can pass to the back-end payment server.
  */
  checkout(cart) {
    let request = this.buildPaymentRequest(cart);
    let response;
    // Show UI then continue with user payment info

    // TODO PAY-5 - display the PaymentRequest
    return request.show()
    .then(r => {
      // The UI will show a spinner to the user until
      // `request.complete()` is called.
      response = r;
      let data = r.toJSON();
      console.log(data);
      return data;
    })
    .then(data => {
      return sendToServer(data);
    })
    .then(() => {
      response.complete('success');
      return response;
    })
    .catch(e => {
      if (response) {
        console.error(e);
        response.complete('fail');
      } else if (e.code !== e.ABORT_ERR) {
        console.error(e);
        throw e;
      } else {
        return null;
      }
    });
}

  /*
   * Creates a PaymentRequest object including the event handlers used to
   * update the payment details as the user makes choices.
   */
  buildPaymentRequest(cart) {
    // Supported payment instruments
    const supportedInstruments = [
      // TODO PAY-3 - add a list of accepted payment methods
      {
        supportedMethods: ['basic-card'],
        data: {
          supportedNetworks: ['visa', 'mastercard', 'amex',
          'jcb', 'diners', 'discover', 'mir', 'unionpay']
        }
      }
    ];

    // Payment options
    const paymentOptions = {

      // TODO PAY-6.1 - allow shipping options
      requestShipping: true,
      // TODO PAY-8 - Add payment options
      requestPayerEmail: true,
      requestPayerPhone: true,
      requestPayerName: true

    };

    let shippingOptions = [];
    let selectedOption = null;

    let details = this.buildPaymentDetails(cart, shippingOptions, selectedOption);

    // TODO PAY-2.2 - initialize the PaymentRequest object
    let request = new PaymentRequest(supportedInstruments, details, paymentOptions);

    // TODO PAY-7.1 - add `shippingaddresschange` event handler
    request.addEventListener('shippingaddresschange', e => {
      e.updateWith((_ => {
        // Get the shipping options and select the least expensive
        shippingOptions = this.optionsForCountry(request.shippingAddress.country);
        selectedOption = shippingOptions[0].id;
        let details = this.buildPaymentDetails(cart, shippingOptions, selectedOption);
        return Promise.resolve(details);
      })());
    });
    // TODO PAY-7.2 - add `shippingoptionchange` event handler
    request.addEventListener('shippingoptionchange', e => {
      e.updateWith((_ => {
        selectedOption = request.shippingOption;
        let details = this.buildPaymentDetails(cart, shippingOptions, selectedOption);
        return Promise.resolve(details);
      })());
    });
    return request;
  }

  /*
   * Creates the PaymentDetails dictionary inside the PaymentRequest.
   * This can change as the user selects shipping options.
   */
  buildPaymentDetails(cart, shippingOptions, shippingOptionId) {

    // TODO PAY-4.2 - define the display items
    let displayItems = cart.cart.map(item => {
      return {
        label: `${item.sku}: ${item.quantity}x Rp. ${item.price}`,
        amount: {currency: 'IDR', value: String(item.total)}
      };
    });

    let total = cart.total;

    // TODO PAY-6.3 - allow shipping options
    let displayedShippingOptions = [];
    if (shippingOptions.length > 0) {
      let selectedOption = shippingOptions.find(option => {
        return option.id === shippingOptionId;
      });
      displayedShippingOptions = shippingOptions.map(option => {
        return {
          id: option.id,
          label: option.label,
          amount: {currency: 'IDR', value: String(option.price)},
          selected: option.id === shippingOptionId
        };
      });
      if (selectedOption) total += selectedOption.price;
    }

    let details = {
      displayItems: displayItems,
      total: {
      label: 'Total due',
      amount: {currency: 'IDR', value: String(total)}
      },
      // TODO PAY-6.2 - allow shipping options
      shippingOptions: displayedShippingOptions
    };

    return details;
  }

  /*
   * Utility function to extract the correct shipping options for a country.
   */
  optionsForCountry(country) {
    country = country.toLowerCase();
    if (!country || !SHIPPING_OPTIONS.hasOwnProperty(country)) {
      country = 'international';
    }
    let options = SHIPPING_OPTIONS[country];
    // Sort by price, lowest first
    options.sort((a, b) => {
      return a.price - b.price;
    });
    return options;
  }

}
