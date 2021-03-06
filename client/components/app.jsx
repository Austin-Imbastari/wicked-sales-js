import React from 'react';
import Headers from './header';
import ProductDetails from './product-details';
import ProductList from './product-list';
import CartSummary from './cart-summary';
import CheckOutForm from './checkout-form';
import HomePage from './homepage';
import CheckoutDisclaimer from './checkout-disclaimer';

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      view: { name: 'homepage', params: {} },
      cart: [],
      displayHeader: false,
      totalPrice: 0
    };
    this.setView = this.setView.bind(this);
    this.addToCart = this.addToCart.bind(this);
  }

  getCartItems() {
    fetch('/api/cart')
      .then(res => res.json());
  }

  addToCart(product) {
    fetch('/api/cart', {
      method: 'POST',
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify({
        productId: product.productId
      })
    })
      .then(result => result.json())
      .then(json => {
        const data = this.state.cart.slice();
        data.push(json);
        this.setState({
          cart: data
        });
      });
  }

  placeOrder(order) {
    fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify({
        name: order.name,
        creditCard: order.creditCard,
        shippingAddress: order.shippingAddress
      })
    })
      .then(result => result.json())
      .then(json => {
        this.setState({
          cart: [],
          view: { name: 'catalog', params: {} }
        });
      });
  }

  componentDidMount() {
    this.getCartItems();
  }

  setView(x, p) {
    this.setState({ view: { name: x, params: p } });
    if (p && p.displayHeader) {
      this.setState({ displayHeader: p.displayHeader });
    } else if (p && p.totalPrice) {
      this.setState({ totalPrice: p.totalPrice });
    }
  }

  render() {
    const displayName = this.state.view.name;
    let display;
    if (displayName === 'homepage') {
      display = <HomePage setView={this.setView} />;
    } else if (displayName === 'catalog') {
      display = <ProductList setView={this.setView}/>;
    } else if (displayName === 'detail') {
      display = <ProductDetails addToCart={this.addToCart} productId={this.state.view.params} setView={this.setView}/>;
    } else if (displayName === 'cart') {
      display = <CartSummary cartItems={this.state.cart} setView={this.setView} />;
    } else if (displayName === 'checkout') {
      display = <CheckOutForm orderItems={this.state.cart} placeOrder={this.placeOrder} setView={this.setView} totalPrice={this.state.totalPrice}/>;
    } else if (displayName === 'checkout-disclaimer') {
      display = <CheckoutDisclaimer setView={this.setView}/>;
    } else {
      display = <p>Nothing to display</p>;
    }
    return (
      <React.Fragment>
        <Headers displayHeader = {this.state.displayHeader} cartItemCount={this.state.cart.length} setView={this.setView} />
        {display}
      </React.Fragment>
    );
  }
}
