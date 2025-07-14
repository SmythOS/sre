import React from 'react';
import { Link } from 'react-router-dom';

const HeaderComponent: React.FC = () => {
  return (
    <>
  <header id="masthead" className="site-header sticky-header" role="banner">
    <div className="header">
      <div className="header-container">
        <div className="header-left active">
          <a href="/" className="logo" aria-label="SmythOS Home">
            <img
              src="https://smythos.com/wp-content/themes/generatepress_child/img/smythos-logo.svg"
              alt="SmythOS Logo"
              width={108}
              height={24}
            />
          </a>
        </div>
        <div className="header-center">
          <nav
            role="navigation"
            aria-label="Main Navigation"
            id="main-nav"
            className="main-nav-start"
          >
            <ul>
              <li>
                <a href="/why-smythos/">Why SmythOS</a>
              </li>
              <li>
                <a href="/product/agent-studio/">Product</a>
              </li>
              <li>
                <a href="/pricing/">Pricing</a>
              </li>
              <li className="active">
                <a href="/docs/">Docs</a>
              </li>
              <li>
                <a href="/updates/">Community</a>
              </li>
              <li>
                <a href="/about-us/">Company</a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="header-right">
          <nav aria-labelledby="main-nav" className="main-nav-end">
            <ul>
              <li>
                <a
                  href="https://app.smythos.com/?_auth=sign-up&source=marketingSite&from="
                  className="sign-up-btn"
                >
                  Try It Free
                </a>
              </li>
              <li>
                <button className="user-menu-trigger icon">
                  <svg
                    width={20}
                    height={20}
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M10 1.538a8.462 8.462 0 1 0 0 16.923 8.462 8.462 0 0 0 0-16.923zM0 10C0 4.477 4.477 0 10 0s10 4.477 10 10c0 5.522-4.477 10-10 10S0 15.522 0 10Z"
                      fill="currentColor"
                    />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M6.55 15.843c-.67.523-.987 1.195-1.067 1.819a.77.77 0 1 1-1.526-.197c.129-1.002.64-2.047 1.645-2.834 1.003-.785 2.443-1.27 4.367-1.27 1.943 0 3.391.487 4.397 1.28 1.009.793 1.513 1.848 1.635 2.86a.77.77 0 1 1-1.527.185c-.077-.635-.391-1.311-1.06-1.837-.67-.528-1.756-.95-3.445-.95-1.669 0-2.749.419-3.42.944zM9.971 5.673a2.611 2.611 0 1 0 0 5.222 2.611 2.611 0 0 0 0-5.222zm-4.15 2.61a4.15 4.15 0 1 1 8.3.001 4.15 4.15 0 0 1-8.3 0z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </li>
              <li>
                <button className="mobile-menu-trigger icon" id="menuIcon">
                  <span />
                  <span />
                  <span />
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
      <div className="header-submenu">
        <div className="header-submenu-container">
          <nav role="navigation" aria-label="Sub Navigation">
            <ul>
              <li>
  <Link to="/docs/agent-studio/overview/" style={{ display: 'flex', alignItems: 'center' }}>
    <svg
      width={16}
      height={16}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        clipPath="url(#a)"
        transform="translate(.4993 -.3315)"
        stroke="currentColor"
      >
        <path
          clipRule="evenodd"
          d="M1 7.9982c0-2.6252.0281-3.5 3.5-3.5s3.5.8748 3.5 3.5.011 3.5-3.5 3.5-3.5-.8748-3.5-3.5ZM9.334 3.8315c0-1.7501.0187-2.3333 2.3333-2.3333s2.3334.5832 2.3334 2.3333c0 1.7501.0073 2.3333-2.3334 2.3333S9.334 5.5816 9.334 3.8315zM9.334 12.8315c0-1.7501.0187-2.3333 2.3333-2.3333s2.3334.5832 2.3334 2.3333c0 1.7501.0073 2.3333-2.3334 2.3333s-2.3333-.5832-2.3333-2.3333z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="m7.2236 11.051 2 1M7.7764 6.051l2-1" />
        <path
          d="M3 8.4982c.8649.8056 2.1521.6859 2.8225 0"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="a">
          <path
            fill="currentColor"
            transform="translate(0 .4982)"
            d="M0 0h16v16H0z"
          />
        </clipPath>
      </defs>
    </svg>
    <span style={{ marginLeft: '0.5rem' }}>Studio</span>
  </Link>
</li>
<li>
  <Link to="/docs/agent-weaver/overview/">
    <span style={{ display: 'flex', alignItems: 'center' }}>
      <svg
        width={16}
        height={16}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M14 4.2087c0-1.1046-.8953-2-2-2H4c-1.1046 0-2 .8954-2 2v5.8555c0 1.1046.8954 2 2 2h1.4413a.9998.9998 0 0 1 .7071.2929l1.1445 1.1445c.3905.3905 1.0237.3905 1.4142 0l1.1445-1.1445a.9997.9997 0 0 1 .7071-.293H12c1.1047 0 2-.8953 2-2z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m10.5 7.4711-1 2.5L8 6.4369 6.5 9.9712l-1.5-4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11.1766 6.328A1.7693 1.7693 0 0 0 10 5.1496a1.7695 1.7695 0 0 0 1.1766-1.1785 1.7696 1.7696 0 0 0 1.1767 1.1785 1.7695 1.7695 0 0 0-1.1767 1.1784z"
          fill="currentColor"
        />
      </svg>
      <span style={{ marginLeft: '0.5rem' }}>Weaver</span>
    </span>
  </Link>
</li>
<li>
  <Link to="/docs/agent-runtime/overview/">
    <span style={{ display: 'flex', alignItems: 'center' }}>
      <svg
        width={16}
        height={16}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5.661 3.0247h4.6815c1.6287 0 2.6374.8841 2.6328 2.5083v4.9305c0 1.6242-1.0093 2.5128-2.638 2.5128H5.661c-1.6236 0-2.6374-.9042-2.6374-2.5544V5.533c0-1.6242 1.0138-2.5083 2.6374-2.5083zM10.6986 3.0248V2M7.9989 3.025v-1.025M5.299 3.025v-1.025M5.299 12.9752V14m2.6999-1.025v1.025m2.6997-1.025v1.025M3.0251 5.2994H2.0002m1.025 2.6998h-1.025m1.025 2.6997h-1.025M12.9749 10.6989h1.0249m-1.025-2.6997h1.025m-1.025-2.6998h1.025"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          clipRule="evenodd"
          d="M9.1163 5.6302h-2.23c-.7739 0-1.2572.421-1.2572 1.1948v2.33c0 .786.4833 1.2169 1.2571 1.2169h2.2275c.7765 0 1.257-.4236 1.257-1.1975V6.825c.0027-.7738-.4785-1.1948-1.2544-1.1948z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={{ marginLeft: '0.5rem' }}>Runtime</span>
    </span>
  </Link>
</li>
<li>
  <Link to="/docs/agent-deployments/overview/">
    <span style={{ display: 'flex', alignItems: 'center' }}>
      <svg
        width={16}
        height={16}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8.9572 5.385c.42-.42 1.1017-.4194 1.5218.0007.42.42.4207 1.1017.0007 1.5218-.42.42-1.1018.4193-1.5219-.0007-.42-.42-.4207-1.1018-.0006-1.5218z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.2474 2.3463c-3.6388-.2471-8.129 3.1116-8.612 6.8915-.0112.3302.1093.6424.3349.868l.9115.9115c.2256.2256.5378.346.868.3349 3.7798-.4833 7.1385-4.9733 6.8914-8.6121-.0146-.215-.1788-.3792-.3938-.3938z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m10.9474 9.2185-.21 2.9536a.6773.6773 0 0 1-.3742.6056l-1.6356.8178a.677.677 0 0 1-.945-.3915l-.7651-1.8692M6.8113 5.0857l-2.955.1895a.677.677 0 0 0-.608.37l-.8291 1.63a.677.677 0 0 0 .385.9477l1.8638.778M4.9084 12.3398c-.1802 1.1997-1.5846.9759-2.5003 1.1135.1376-.9157-.0785-2.3124 1.1212-2.4926"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={{ marginLeft: '0.5rem' }}>Deployments</span>
    </span>
  </Link>
</li>
<li>
  <Link to="/docs/agent-collaboration/overview/">
    <span style={{ display: 'flex', alignItems: 'center' }}>
      <svg
        width={16}
        height={16}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8.0527 4.797c-.4017.061-.8102-.0006-1.2158.0093-.9404.0235-1.6773.8516-2.3928 1.4127-.3662.2875-.8778.2494-1.2012-.0892-.3589-.375-.3589-.9837 0-1.3593.773-.8081 1.4558-1.5587 2.5038-1.983 1.4542-.5893 2.803-.3029 4.2757 0M8.054 4.8156H7.26M2.9737 13.6672h.5955c.4547 0 .7375-.334.7375-.807v-2.7695c0-.473-.2828-.8075-.7375-.8075h-.5955"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.9888 9.1661c-.6536-.1708-1.306-.3052-1.9883-.2876-1.0817.027-1.8378.655-2.6948 1.253M7.9473 11.2025c.4017-.061.8102.0006 1.2159-.0094.9403-.0234 1.6772-.8515 2.3927-1.4126.3663-.2875.8778-.2494 1.2012.0892.359.375.359.9836 0 1.3592-.773.8082-1.4558 1.5588-2.5038 1.9832-1.4541.5892-2.803.3028-4.2757 0m1.9686-2.0282H8.74M7.0108 6.832c.6535.1708 1.306.3052 1.9883.2876 1.0817-.027 1.8378-.655 2.6948-1.253"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.0255 2.3328H12.43c-.4546 0-.7374.334-.7374.807v2.7694c0 .473.2828.8076.7374.8076h.5956"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={{ marginLeft: '0.5rem' }}>Collaboration</span>
    </span>
  </Link>
</li>

<li>
  <Link to="/docs/agent-templates/overview/">
    <span style={{ display: 'flex', alignItems: 'center' }}>
      <svg
        width={16}
        height={16}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          clipRule="evenodd"
          d="M1.9997 4.3333C1.9997 2.5832 2.0184 2 4.333 2s2.3333.5832 2.3333 2.3333c0 1.7502.0074 2.3334-2.3333 2.3334s-2.3333-.5832-2.3333-2.3334zM9.3336 4.3333C9.3336 2.5832 9.3524 2 11.667 2s2.3334.5832 2.3334 2.3333c0 1.7502.0073 2.3334-2.3334 2.3334s-2.3334-.5832-2.3334-2.3334zM1.9997 11.6667c0-1.7502.0187-2.3333 2.3333-2.3333s2.3333.5831 2.3333 2.3333C6.6663 13.4168 6.6737 14 4.333 14s-2.3333-.5832-2.3333-2.3333zM9.3336 11.6667c0-1.7502.0188-2.3333 2.3334-2.3333s2.3334.5831 2.3334 2.3333c0 1.7501.0073 2.3333-2.3334 2.3333s-2.3334-.5832-2.3334-2.3333z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={{ marginLeft: '0.5rem' }}>Templates</span>
    </span>
  </Link>
</li>

            </ul>
          </nav>
        </div>
      </div>
    </div>
  </header>
  <div
    className="mobile-menu"
    aria-hidden="true"
    role="dialog"
    aria-modal="true"
    aria-label="Mobile Menu"
  >
    <nav id="mobileMenu" role="navigation" aria-label="Mobile Navigation">
      <ul role="menu">
        <li className="menu-label always-open" role="none">
          <div className="menu-label-content">Go to...</div>
          <ul className="submenu" role="menu">
            <li role="none">
              <a
                href="https://app.smythos.com/"
                role="menuitem"
                className="log-in"
              >
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M2.6896 2.4614C3.5635 1.524 4.8076 1 6.2748 1h7.4503c1.4708 0 2.7153.5237 3.5886 1.4618.8682.9326 1.3185 2.219 1.3185 3.661v3.5817a.683.683 0 1 1-1.366 0V6.1227c0-1.16-.3596-2.0933-.9524-2.7301-.5877-.6313-1.4552-1.0265-2.5887-1.0265H6.2748c-1.129 0-1.997.395-2.586 1.0268-.594.6372-.955 1.5707-.955 2.7298v7.019c0 1.1594.3595 2.0925.9523 2.7292.5877.6312 1.4553 1.0263 2.5887 1.0263H7.821a.683.683 0 0 1 0 1.3661H6.2748c-1.4708 0-2.7152-.5236-3.5885-1.4616-.8681-.9324-1.3185-2.2187-1.3185-3.66v-7.019c0-1.4427.4529-2.7291 1.3218-3.6613z"
                    fill="currentColor"
                    style={{ strokeWidth: ".948654" }}
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M4.23 4.8171a.683.683 0 0 1 .683-.683h.0585a.683.683 0 0 1 0 1.366H4.913a.683.683 0 0 1-.683-.683Zm2.322 0a.683.683 0 0 1 .683-.683h.0586a.683.683 0 1 1 0 1.366H7.235a.683.683 0 0 1-.683-.683Zm2.3226 0a.683.683 0 0 1 .683-.683h.0585a.683.683 0 0 1 0 1.366h-.0585a.683.683 0 0 1-.683-.683ZM1.3678 7.4143a.683.683 0 0 1 .683-.683h15.8984a.683.683 0 0 1 0 1.366H2.0508a.683.683 0 0 1-.683-.683Z"
                    fill="currentColor"
                    style={{ strokeWidth: ".948654" }}
                  />
                  <path
                    clipRule="evenodd"
                    d="m16.21 16.081-1.7342.3886a.1956.1956 0 0 0-.1227.0857l-.8353 1.306c-.406.636-1.378.4643-1.5433-.2713l-.9321-4.6287c-.1653-.7384.6442-1.3069 1.282-.9027l4.1543 2.4773c.6386.4052.4688 1.38-.2687 1.5451z"
                    stroke="currentColor"
                    strokeWidth="1.4969"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                <span className="link-text">SmythOS app</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
            <li role="none">
              <a href="/why-smythos/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M17.9754 10c0-4.5886-3.5704-8.3077-7.9754-8.3077-4.405 0-7.9754 3.719-7.9754 8.3077 0 4.5876 3.5704 8.3077 7.9754 8.3077 4.405 0 7.9754-3.72 7.9754-8.3077zm-8.0216 3.8996v-.026"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38462" }}
                  />
                  <path
                    d="M9.952 11.615c-.0103-.8227.708-1.1712 1.2417-1.4883.6509-.3736 1.0915-.969 1.0915-1.7945 0-1.2231-.9493-2.2048-2.1157-2.2048-1.1745 0-2.117.9817-2.117 2.2048"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38462" }}
                  />
                </svg>{" "}
                <span className="link-text">Why SmythOS</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
            <li role="none">
              <a href="/pricing/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M4.1673 4.4685C4.1673 2.5533 5.6572 1 7.4962 1h5.0076c1.8382 0 3.3289 1.5531 3.3289 3.4685v11.0639c0 1.9157-1.491 3.4676-3.3289 3.4676H7.4962c-1.8388 0-3.3289-1.5522-3.3289-3.4676Zm3.3289-2.0839c-1.1045 0-1.9997.9327-1.9997 2.0839v11.0639c0 1.1509.895 2.083 1.9997 2.083h5.0076c1.104 0 1.9997-.9324 1.9997-2.083V4.4684c0-1.1508-.8959-2.0838-1.9997-2.0838z"
                    fill="currentColor"
                    style={{ strokeWidth: "1.38462" }}
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M7.2502 9.2555c0-.3824.2976-.6923.6646-.6923h4.174c.367 0 .6646.3099.6646.6923 0 .3823-.2975.6923-.6646.6923h-4.174c-.367 0-.6646-.31-.6646-.6923zm0-3.2436c0-.3823.2976-.6923.6646-.6923h4.174c.367 0 .6646.31.6646.6923 0 .3824-.2975.6923-.6646.6923h-4.174c-.367 0-.6646-.3099-.6646-.6923Zm1.8796 8.9533c0-.5006.3899-.9052.869-.9052.4794 0 .8694.4046.8694.905 0 .5002-.3891.9056-.8693.9056-.48 0-.8691-.4054-.8691-.9055z"
                    fill="currentColor"
                    style={{ strokeWidth: "1.38462" }}
                  />
                </svg>{" "}
                <span className="link-text">Pricing</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
          </ul>
        </li>
        <li className="menu-label has-submenu-m" role="none">
          <div className="menu-label-content">
            Product{" "}
            <svg
              width={14}
              height={14}
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8.20518 14.2972C8.64463 14.7366 9.3583 14.7366 9.79775 14.2972L16.5478 7.54717C16.9872 7.10771 16.9872 6.39404 16.5478 5.95459C16.1083 5.51514 15.3946 5.51514 14.9552 5.95459L8.99971 11.9101L3.04424 5.95811C2.60479 5.51865 1.89111 5.51865 1.45166 5.95811C1.01221 6.39756 1.01221 7.11123 1.45166 7.55068L8.20166 14.3007L8.20518 14.2972Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <ul className="submenu" role="menu">
            <li role="none">
              <a href="/product/agent-studio/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <g
                    clipPath="url(#a)"
                    transform="matrix(1.22728 0 0 1.22728 .7945 -.225)"
                    stroke="currentColor"
                  >
                    <path
                      clipRule="evenodd"
                      d="M1 7.9982c0-2.6252.0281-3.5 3.5-3.5s3.5.8748 3.5 3.5.011 3.5-3.5 3.5-3.5-.8748-3.5-3.5zm8.334-4.1667c0-1.7501.0187-2.3333 2.3333-2.3333s2.3334.5832 2.3334 2.3333c0 1.7501.0073 2.3333-2.3334 2.3333S9.334 5.5816 9.334 3.8315zm0 9c0-1.7501.0187-2.3333 2.3333-2.3333s2.3334.5832 2.3334 2.3333c0 1.7501.0073 2.3333-2.3334 2.3333s-2.3333-.5832-2.3333-2.3333z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="m7.2236 11.051 2 1m-1.4472-6 2-1" />
                    <path
                      d="M3 8.4982c.8649.8056 2.1521.6859 2.8225 0"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                  <defs>
                    <clipPath id="a">
                      <path
                        fill="currentColor"
                        transform="translate(0 .4982)"
                        d="M0 0h16v16H0Z"
                      />
                    </clipPath>
                  </defs>
                </svg>{" "}
                <span className="link-text">Studio</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
            <li role="none">
              <a href="/product/agent-weaver/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M18.3077 4.7505c0-1.5295-1.2397-2.7693-2.7692-2.7693H4.4615c-1.5294 0-2.7692 1.2398-2.7692 2.7693v8.1076c0 1.5294 1.2398 2.7692 2.7692 2.7692h1.9957a1.3843 1.3843 0 0 1 .979.4056l1.5847 1.5847c.5407.5407 1.4175.5407 1.9582 0l1.5847-1.5847a1.3842 1.3842 0 0 1 .979-.4057h1.9957c1.5295 0 2.7692-1.2397 2.7692-2.7693z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38461" }}
                  />
                  <path
                    d="m13.4615 9.2676-1.3846 3.4616L10 7.8357l-2.077 4.8936L5.8463 7.191"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38461" }}
                  />
                  <path
                    d="M14.3984 7.6849a2.4498 2.4498 0 0 0-1.6292-1.6316 2.45 2.45 0 0 0 1.6292-1.6318 2.4502 2.4502 0 0 0 1.6292 1.6318 2.45 2.45 0 0 0-1.6292 1.6316Z"
                    fill="currentColor"
                    style={{ strokeWidth: "1.38461" }}
                  />
                </svg>{" "}
                <span className="link-text">Weaver</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
            <li role="none">
              <a href="/product/agent-runtime/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M6.7614 3.1111h6.482c2.2552 0 3.6518 1.2242 3.6455 3.473v6.8269c0 2.2489-1.3975 3.4793-3.6526 3.4793h-6.475c-2.248 0-3.6517-1.252-3.6517-3.5369V6.5842c0-2.249 1.4037-3.473 3.6518-3.473zm6.9751.0002v-1.419m-3.738 1.4192V1.6923M6.2602 3.1115V1.6923m0 15.1964v1.419m3.7383-1.4192v1.4192m3.738-1.4192v1.4192M3.1117 6.2607H1.6926M3.1118 9.999H1.6926m1.4192 3.738H1.6926m15.1957 0h1.4191m-1.4192-3.738h1.4192m-1.4192-3.7382h1.4192"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38462" }}
                  />
                  <path
                    clipRule="evenodd"
                    d="M11.5456 6.7187H8.458c-1.0716 0-1.7408.583-1.7408 1.6544v3.2261c0 1.0883.6692 1.685 1.7406 1.685h3.0842c1.0752 0 1.7405-.5866 1.7405-1.6581V8.373c.0037-1.0714-.6625-1.6544-1.7369-1.6544z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38462" }}
                  />
                </svg>{" "}
                <span className="link-text">Runtime</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
            <li role="none">
              <a href="/product/agent-deployments/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M11.3953 6.1846c.6131-.613 1.6082-.6122 2.2214.001.6131.6131.6141 1.6082.001 2.2214-.613.6131-1.6083.6121-2.2215-.001-.613-.613-.6141-1.6083-.0009-2.2214z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.45971" }}
                  />
                  <path
                    d="M17.6578 1.749c-5.3116-.3607-11.866 4.542-12.571 10.0596-.0164.482.1595.9377.4888 1.267l1.3305 1.3306c.3294.3293.785.505 1.267.4888 5.5175-.7055 10.4202-7.2596 10.0595-12.5711-.0213-.3139-.261-.5536-.5748-.5749Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.45971" }}
                  />
                  <path
                    d="m14.3004 11.7804-.3065 4.3114a.9887.9887 0 0 1-.5462.884l-2.3875 1.1938a.9882.9882 0 0 1-1.3794-.5715l-1.1169-2.7285m-.301-9.1218-4.3134.2766a.9882.9882 0 0 0-.8875.54L1.8518 8.9439a.9882.9882 0 0 0 .562 1.3834l2.7205 1.1356m.351 4.8738c-.263 1.7512-2.313 1.4246-3.6497 1.6254.2008-1.3366-.1146-3.3754 1.6366-3.6385"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.45971" }}
                  />
                </svg>{" "}
                <span className="link-text">Deployments</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
            <li role="none">
              <a href="/product/agent-collaboration/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M10.0769 5.3258c-.5862.089-1.1824-.001-1.7743.0135-1.3723.0343-2.4477 1.2428-3.4919 2.0616-.5344.4196-1.281.364-1.753-.1301-.5237-.5473-.5237-1.4356 0-1.9837 1.1282-1.1793 2.1246-2.2747 3.654-2.8939 2.1221-.86 4.0905-.442 6.2396 0M10.0788 5.353H8.92M2.6649 18.2703h.869c.6636 0 1.0763-.4874 1.0763-1.1776V13.051c0-.6902-.4127-1.1784-1.0762-1.1784h-.869"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.45933" }}
                  />
                  <path
                    d="M11.443 11.7017c-.9539-.2492-1.906-.4454-2.9016-.4197-1.5786.0394-2.682.9559-3.9326 1.8286m5.3143 1.563c.5862-.0891 1.1823.0008 1.7744-.0138 1.3722-.0342 2.4476-1.2426 3.4917-2.0615.5346-.4195 1.281-.364 1.753.1302.5239.5473.5239 1.4354 0 1.9835-1.128 1.1795-2.1245 2.2748-3.6539 2.8942-2.122.8598-4.0905.4419-6.2397 0m2.8729-2.9598h1.1584M8.5564 8.2955c.9537.2493 1.9059.4454 2.9016.4197 1.5786-.0394 2.682-.9559 3.9326-1.8285"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.45933" }}
                  />
                  <path
                    d="M17.3339 1.7297h-.869c-.6635 0-1.0762.4874-1.0762 1.1776v4.0415c0 .6903.4127 1.1786 1.0761 1.1786h.8692"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.45933" }}
                  />
                </svg>{" "}
                <span className="link-text">Collaboration</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
            <li role="none">
              <a href="/templates/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    clipRule="evenodd"
                    d="M1.6918 4.923c0-2.4232.026-3.2307 3.2307-3.2307 3.2049 0 3.2308.8075 3.2308 3.2307 0 2.4234.0102 3.2309-3.2308 3.2309S1.6918 7.3464 1.6918 4.923zm10.1547 0c0-2.4232.026-3.2307 3.2308-3.2307s3.2309.8075 3.2309 3.2307c0 2.4234.01 3.2309-3.2309 3.2309-3.241 0-3.2308-.8075-3.2308-3.2309zM1.6918 15.077c0-2.4234.026-3.2308 3.2307-3.2308 3.2049 0 3.2308.8074 3.2308 3.2308 0 2.4232.0102 3.2307-3.2308 3.2307s-3.2307-.8075-3.2307-3.2307zm10.1547 0c0-2.4234.026-3.2308 3.2308-3.2308s3.2309.8074 3.2309 3.2308c0 2.4232.01 3.2307-3.2309 3.2307-3.241 0-3.2308-.8075-3.2308-3.2307z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38462" }}
                  />
                </svg>{" "}
                <span className="link-text">Templates</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
          </ul>
        </li>
        <li className="menu-label has-submenu-m" role="none">
          <div className="menu-label-content">
            Docs{" "}
            <svg
              width={14}
              height={14}
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8.20518 14.2972C8.64463 14.7366 9.3583 14.7366 9.79775 14.2972L16.5478 7.54717C16.9872 7.10771 16.9872 6.39404 16.5478 5.95459C16.1083 5.51514 15.3946 5.51514 14.9552 5.95459L8.99971 11.9101L3.04424 5.95811C2.60479 5.51865 1.89111 5.51865 1.45166 5.95811C1.01221 6.39756 1.01221 7.11123 1.45166 7.55068L8.20166 14.3007L8.20518 14.2972Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <ul className="submenu" role="menu">
            <li role="none">
<Link to="/docs/agent-studio/overview/" role="menuitem">
  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
    <svg
      width={20}
      height={20}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
    >
      <g
        clipPath="url(#a)"
        transform="matrix(1.22728 0 0 1.22728 .7945 -.225)"
        stroke="currentColor"
      >
        <path
          clipRule="evenodd"
          d="M1 7.9982c0-2.6252.0281-3.5 3.5-3.5s3.5.8748 3.5 3.5.011 3.5-3.5 3.5-3.5-.8748-3.5-3.5zm8.334-4.1667c0-1.7501.0187-2.3333 2.3333-2.3333s2.3334.5832 2.3334 2.3333c0 1.7501.0073 2.3333-2.3334 2.3333S9.334 5.5816 9.334 3.8315zm0 9c0-1.7501.0187-2.3333 2.3333-2.3333s2.3334.5832 2.3334 2.3333c0 1.7501.0073 2.3333-2.3334 2.3333s-2.3333-.5832-2.3333-2.3333z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="m7.2236 11.051 2 1m-1.4472-6 2-1" />
        <path
          d="M3 8.4982c.8649.8056 2.1521.6859 2.8225 0"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="a">
          <path
            fill="currentColor"
            transform="translate(0 .4982)"
            d="M0 0h16v16H0Z"
          />
        </clipPath>
      </defs>
    </svg>

    <span className="link-text">Studio</span>

    <svg
      className="icon-right"
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
</Link>

            </li>
            <li role="none">
            <Link to="/docs/agent-weaver/overview/" role="menuitem">
  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
    <svg
      width={20}
      height={20}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
    >
      <path
        d="M18.3077 4.7505c0-1.5295-1.2397-2.7693-2.7692-2.7693H4.4615c-1.5294 0-2.7692 1.2398-2.7692 2.7693v8.1076c0 1.5294 1.2398 2.7692 2.7692 2.7692h1.9957a1.3843 1.3843 0 0 1 .979.4056l1.5847 1.5847c.5407.5407 1.4175.5407 1.9582 0l1.5847-1.5847a1.3842 1.3842 0 0 1 .979-.4057h1.9957c1.5295 0 2.7692-1.2397 2.7692-2.7693z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeWidth: "1.38461" }}
      />
      <path
        d="m13.4615 9.2676-1.3846 3.4616L10 7.8357l-2.077 4.8936L5.8463 7.191"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeWidth: "1.38461" }}
      />
      <path
        d="M14.3984 7.6849a2.4498 2.4498 0 0 0-1.6292-1.6316 2.45 2.45 0 0 0 1.6292-1.6318 2.4502 2.4502 0 0 0 1.6292 1.6318 2.45 2.45 0 0 0-1.6292 1.6316Z"
        fill="currentColor"
        style={{ strokeWidth: "1.38461" }}
      />
    </svg>

    <span className="link-text">Weaver</span>

    <svg
      className="icon-right"
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
</Link>
            </li>
            <li role="none">
  <Link to="/docs/agent-runtime/overview/" role="menuitem">
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <svg
        width={20}
        height={20}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
      >
        <path
          d="M6.7614 3.1111h6.482c2.2552 0 3.6518 1.2242 3.6455 3.473v6.8269c0 2.2489-1.3975 3.4793-3.6526 3.4793h-6.475c-2.248 0-3.6517-1.252-3.6517-3.5369V6.5842c0-2.249 1.4037-3.473 3.6518-3.473zm6.9751.0002v-1.419m-3.738 1.4192V1.6923M6.2602 3.1115V1.6923m0 15.1964v1.419m3.7383-1.4192v1.4192m3.738-1.4192v1.4192M3.1117 6.2607H1.6926M3.1118 9.999H1.6926m1.4192 3.738H1.6926m15.1957 0h1.4191m-1.4192-3.738h1.4192m-1.4192-3.7382h1.4192"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeWidth: "1.38462" }}
        />
        <path
          clipRule="evenodd"
          d="M11.5456 6.7187H8.458c-1.0716 0-1.7408.583-1.7408 1.6544v3.2261c0 1.0883.6692 1.685 1.7406 1.685h3.0842c1.0752 0 1.7405-.5866 1.7405-1.6581V8.373c.0037-1.0714-.6625-1.6544-1.7369-1.6544z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeWidth: "1.38462" }}
        />
      </svg>

      <span className="link-text">Runtime</span>

      <svg
        className="icon-right"
        width={20}
        height={20}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  </Link>
</li>

            <li role="none">
            <Link to="/docs/agent-deployments/overview/" role="menuitem">
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <svg
        width={20}
        height={20}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
      >
        <path
          d="M11.3953 6.1846c.6131-.613 1.6082-.6122 2.2214.001.6131.6131.6141 1.6082.001 2.2214-.613.6131-1.6083.6121-2.2215-.001-.613-.613-.6141-1.6083-.0009-2.2214z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeWidth: "1.45971" }}
        />
        <path
          d="M17.6578 1.749c-5.3116-.3607-11.866 4.542-12.571 10.0596-.0164.482.1595.9377.4888 1.267l1.3305 1.3306c.3294.3293.785.505 1.267.4888 5.5175-.7055 10.4202-7.2596 10.0595-12.5711-.0213-.3139-.261-.5536-.5748-.5749Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeWidth: "1.45971" }}
        />
        <path
          d="m14.3004 11.7804-.3065 4.3114a.9887.9887 0 0 1-.5462.884l-2.3875 1.1938a.9882.9882 0 0 1-1.3794-.5715l-1.1169-2.7285m-.301-9.1218-4.3134.2766a.9882.9882 0 0 0-.8875.54L1.8518 8.9439a.9882.9882 0 0 0 .562 1.3834l2.7205 1.1356m.351 4.8738c-.263 1.7512-2.313 1.4246-3.6497 1.6254.2008-1.3366-.1146-3.3754 1.6366-3.6385"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeWidth: "1.45971" }}
        />
      </svg>

      <span className="link-text">Deployments</span>

      <svg
        className="icon-right"
        width={20}
        height={20}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  </Link>
            </li>
            <li role="none">
            <Link to="/docs/agent-collaboration/overview/" role="menuitem">
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <svg
        width={20}
        height={20}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
      >
        <path
          d="M10.0769 5.3258c-.5862.089-1.1824-.001-1.7743.0135-1.3723.0343-2.4477 1.2428-3.4919 2.0616-.5344.4196-1.281.364-1.753-.1301-.5237-.5473-.5237-1.4356 0-1.9837 1.1282-1.1793 2.1246-2.2747 3.654-2.8939 2.1221-.86 4.0905-.442 6.2396 0M10.0788 5.353H8.92M2.6649 18.2703h.869c.6636 0 1.0763-.4874 1.0763-1.1776V13.051c0-.6902-.4127-1.1784-1.0762-1.1784h-.869"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeWidth: "1.45933" }}
        />
        <path
          d="M11.443 11.7017c-.9539-.2492-1.906-.4454-2.9016-.4197-1.5786.0394-2.682.9559-3.9326 1.8286m5.3143 1.563c.5862-.0891 1.1823.0008 1.7744-.0138 1.3722-.0342 2.4476-1.2426 3.4917-2.0615.5346-.4195 1.281-.364 1.753.1302.5239.5473.5239 1.4354 0 1.9835-1.128 1.1795-2.1245 2.2748-3.6539 2.8942-2.122.8598-4.0905.4419-6.2397 0m2.8729-2.9598h1.1584M8.5564 8.2955c.9537.2493 1.9059.4454 2.9016.4197 1.5786-.0394 2.682-.9559 3.9326-1.8285"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeWidth: "1.45933" }}
        />
        <path
          d="M17.3339 1.7297h-.869c-.6635 0-1.0762.4874-1.0762 1.1776v4.0415c0 .6903.4127 1.1786 1.0761 1.1786h.8692"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeWidth: "1.45933" }}
        />
      </svg>

      <span className="link-text">Collaboration</span>

      <svg
        className="icon-right"
        width={20}
        height={20}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  </Link>
            </li>
            <li role="none">
            <Link to="/docs/agent-templates/overview/" role="menuitem">
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <svg
        width={20}
        height={20}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
      >
        <path
          clipRule="evenodd"
          d="M1.6918 4.923c0-2.4232.026-3.2307 3.2307-3.2307 3.2049 0 3.2308.8075 3.2308 3.2307 0 2.4234.0102 3.2309-3.2308 3.2309S1.6918 7.3464 1.6918 4.923zm10.1547 0c0-2.4232.026-3.2307 3.2308-3.2307s3.2309.8075 3.2309 3.2307c0 2.4234.01 3.2309-3.2309 3.2309-3.241 0-3.2308-.8075-3.2308-3.2309zM1.6918 15.077c0-2.4234.026-3.2308 3.2307-3.2308 3.2049 0 3.2308.8074 3.2308 3.2308 0 2.4232.0102 3.2307-3.2308 3.2307s-3.2307-.8075-3.2307-3.2307zm10.1547 0c0-2.4234.026-3.2308 3.2308-3.2308s3.2309.8074 3.2309 3.2308c0 2.4232.01 3.2307-3.2309 3.2307-3.241 0-3.2308-.8075-3.2308-3.2307z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeWidth: "1.38462" }}
        />
      </svg>

      <span className="link-text">Templates</span>

      <svg
        className="icon-right"
        width={20}
        height={20}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  </Link>
            </li>
          </ul>
        </li>
        <li className="menu-label has-submenu-m" role="none">
          <div className="menu-label-content">
            Community{" "}
            <svg
              width={14}
              height={14}
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8.20518 14.2972C8.64463 14.7366 9.3583 14.7366 9.79775 14.2972L16.5478 7.54717C16.9872 7.10771 16.9872 6.39404 16.5478 5.95459C16.1083 5.51514 15.3946 5.51514 14.9552 5.95459L8.99971 11.9101L3.04424 5.95811C2.60479 5.51865 1.89111 5.51865 1.45166 5.95811C1.01221 6.39756 1.01221 7.11123 1.45166 7.55068L8.20166 14.3007L8.20518 14.2972Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <ul className="submenu" role="menu">
            <li role="none">
              <a href="/updates/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M1.6923 5.156v10.3825a1.8464 1.8464 0 0 0 1.8461 1.846h12.9232a1.8465 1.8465 0 0 0 1.846-1.846V7.6923c0-.7648-.6198-1.3847-1.3845-1.3847h-2.3078"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38462" }}
                  />
                  <path
                    d="M16.4616 17.3846a1.8461 1.8461 0 0 1-1.8463-1.8461V4c0-.7647-.6199-1.3846-1.3846-1.3846H3.077c-.7647 0-1.3846.62-1.3846 1.3846v6.6947m9.2308-4.387H5.3847M10.923 10H7.2308"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38462" }}
                  />
                </svg>{" "}
                <span className="link-text">Updates</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
            <li role="none">
              <a href="/blog/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M6.2632 1.6923h7.4744c2.6125 0 4.2378 1.9212 4.2378 4.6399v7.3358c0 2.7185-1.6253 4.6397-4.2385 4.6397H6.2632c-2.6125 0-4.2386-1.9212-4.2386-4.6397V6.332c0-2.7185 1.6339-4.6397 4.2386-4.6397zM4.9891 4.969h-.0492m2.2518 0h-.0491m2.2527 0H9.346m8.6294 2.715H2.0246m5.1437.0217v10.5566m.0297-5.7354h10.724"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38462" }}
                  />
                </svg>{" "}
                <span className="link-text">Posts</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
            <li role="none">
              <a href="/ai-trends/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M13.7647 5.4838h4.5163l.0002 4.5165"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.43764" }}
                  />
                  <path
                    d="m18.2805 5.4832-7.1519 7.1517L7.365 8.8706l-5.646 5.6462"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.43764" }}
                  />
                </svg>{" "}
                <span className="link-text">Trending</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
            <li role="none">
              <a
                href="https://discord.gg/smythos"
                role="menuitem"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M7.6488 14.551c-.1985.3056-.6944 1.0654-.936 1.3358-.1195.133-.3414.2775-.4967.2587-1.4139-.1752-2.7397-.5902-3.8355-1.5548-.4508-.398-.7339-.8489-.6835-1.5108.1752-2.2925.6924-4.4931 1.5476-6.6283.3864-.9628 1.0744-1.6285 2.0238-1.9553.547-.2282 1.156-.4096 1.748-.5103 1.0473-.1786 1.0815-.238 1.3248.6719a12.7004 12.7004 0 0 1 3.3127 0c.2425-.9098.282-.8507 1.3303-.6719.592.1007 1.2001.282 1.747.5102.9503.327 1.6384.9926 2.0246 1.9554.8553 2.1352 1.3726 4.3358 1.5469 6.6283.0512.6619-.2327 1.1128-.6836 1.5108-1.095.9646-2.4217 1.3796-3.8344 1.5548-.1565.0188-.3784-.1257-.497-.2587-.2416-.2704-.7383-1.0302-.9359-1.3357"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38478" }}
                  />
                  <path
                    d="M5.5184 13.5758c2.9876 1.7802 5.975 1.7802 8.9626 0"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38478" }}
                  />
                  <path
                    clipRule="evenodd"
                    d="M8.53 10.0137c0 .7478-.5165 1.3532-1.1542 1.3532-.6368 0-1.1542-.6054-1.1542-1.3532 0-.7478.5174-1.3534 1.1542-1.3534.6377 0 1.1543.6056 1.1543 1.3534zm5.2471 0c0 .7478-.5165 1.3532-1.1542 1.3532-.6377 0-1.1542-.6053-1.1542-1.353 0-.7479.5165-1.3534 1.1542-1.3534.6377 0 1.1542.6055 1.1542 1.3533z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38478" }}
                  />
                </svg>{" "}
                <span className="link-text">Discord Community</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
          </ul>
        </li>
        <li className="menu-label has-submenu-m" role="none">
          <div className="menu-label-content">
            Company{" "}
            <svg
              width={14}
              height={14}
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8.20518 14.2972C8.64463 14.7366 9.3583 14.7366 9.79775 14.2972L16.5478 7.54717C16.9872 7.10771 16.9872 6.39404 16.5478 5.95459C16.1083 5.51514 15.3946 5.51514 14.9552 5.95459L8.99971 11.9101L3.04424 5.95811C2.60479 5.51865 1.89111 5.51865 1.45166 5.95811C1.01221 6.39756 1.01221 7.11123 1.45166 7.55068L8.20166 14.3007L8.20518 14.2972Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <ul className="submenu" role="menu">
            <li role="none">
              <a href="/about-us/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M10.0769 5.3258c-.5862.089-1.1824-.001-1.7743.0135-1.3723.0343-2.4477 1.2428-3.4919 2.0616-.5344.4196-1.281.364-1.753-.1301-.5237-.5473-.5237-1.4356 0-1.9837 1.1282-1.1793 2.1246-2.2747 3.654-2.8939 2.1221-.86 4.0905-.442 6.2396 0M10.0788 5.353H8.92M2.6649 18.2703h.869c.6636 0 1.0763-.4874 1.0763-1.1776V13.051c0-.6902-.4127-1.1784-1.0762-1.1784h-.869"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.45933" }}
                  />
                  <path
                    d="M11.443 11.7017c-.9539-.2492-1.906-.4454-2.9016-.4197-1.5786.0394-2.682.9559-3.9326 1.8286m5.3143 1.563c.5862-.0891 1.1823.0008 1.7744-.0138 1.3722-.0342 2.4476-1.2426 3.4917-2.0615.5346-.4195 1.281-.364 1.753.1302.5239.5473.5239 1.4354 0 1.9835-1.128 1.1795-2.1245 2.2748-3.6539 2.8942-2.122.8598-4.0905.4419-6.2397 0m2.8729-2.9598h1.1584M8.5564 8.2955c.9537.2493 1.9059.4454 2.9016.4197 1.5786-.0394 2.682-.9559 3.9326-1.8285"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.45933" }}
                  />
                  <path
                    d="M17.3339 1.7297h-.869c-.6635 0-1.0762.4874-1.0762 1.1776v4.0415c0 .6903.4127 1.1786 1.0761 1.1786h.8692"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.45933" }}
                  />
                </svg>{" "}
                <span className="link-text">About us</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
            <li role="none">
              <a href="/updates/press/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M2.7525 4.691v10.4846c0-1.7296 1.3458-3.1317 3.0063-3.1317h7.7572c.5958 0 1.0786-.502 1.0786-1.1226V2.815c0-.6205-.4828-1.1226-1.0786-1.1226H5.6322c-1.5908 0-2.8797 1.3426-2.8797 2.9988z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38459" }}
                  />
                  <path
                    d="M2.7525 15.176c0 1.7298 1.3458 3.1317 3.0063 3.1317H16.169c.5958 0 1.0786-.5029 1.0786-1.1235V5.4908M6.049 15.1884h8.378"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38459" }}
                  />
                </svg>{" "}
                <span className="link-text">Press</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
            <li role="none">
              <a href="/our-people/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    clipRule="evenodd"
                    d="M7.6914 19.1305c-3.5475 0-6.5783-.5363-6.5783-2.6848 0-2.1487 3.0113-4.0847 6.5783-4.0847 3.5475 0 6.5772 1.9176 6.5772 4.0654 0 2.1476-3.0103 2.7041-6.5772 2.7041zm0-9.8287c2.3283 0 4.2162-1.8878 4.2162-4.2162 0-2.3283-1.888-4.2161-4.2164-4.2161-2.3282 0-4.216 1.8878-4.216 4.2163-.0088 2.3205 1.8665 4.2083 4.1862 4.216z"
                    stroke="currentColor"
                    strokeWidth="1.739"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14.6888 8.1366c1.3555-.3622 2.3543-1.598 2.3543-3.0683.001-1.5343-1.0878-2.8153-2.535-3.112m.8178 9.6348c1.9205 0 3.561 1.3023 3.561 2.4645 0 .685-.5652 1.3884-1.425 1.5904"
                    stroke="currentColor"
                    strokeWidth="1.739"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
                <span className="link-text">People</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
            <li role="none">
              <a href="/updates/changelog/" role="menuitem">
                <svg
                  width={20}
                  height={20}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M17.0911 5.9061C15.2252 2.4823 11.246.8165 7.5407 2.1489 3.3834 3.6475 1.1717 8.377 2.6104 12.7075c1.4308 4.3398 5.97 6.6445 10.1363 5.145 2.5768-.9252 4.4065-3.0813 5.0818-5.626"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38504" }}
                  />
                  <path
                    d="M17.3068 2.8643v3.046h-2.9085m-1.7473 6.4623-2.8135-1.7517V6.837"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeWidth: "1.38504" }}
                  />
                </svg>{" "}
                <span className="link-text">Changelog</span>
                <svg
                  className="icon-right"
                  width={20}
                  height={20}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{" "}
              </a>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  </div>
  <div id="overlay" aria-hidden="true" tabIndex={-1} />
  <div
    className="user-menu"
    aria-hidden="true"
    role="dialog"
    aria-modal="true"
    aria-label="User Menu"
    style={{ left: 1622 }}
  >
    <nav id="userMenu" role="navigation" aria-label="User Navigation">
      <ul role="menu">
        <li className="menu-label" role="none">
          Go to...
        </li>
        <li role="none">
          <a href="https://app.smythos.com/" role="menuitem" className="log-in">
            <svg
              width={20}
              height={20}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M1.86 1.627C2.835.583 4.22 0 5.853 0h8.296c1.637 0 3.023.583 3.995 1.628.967 1.038 1.468 2.47 1.468 4.076v3.988a.76.76 0 1 1-1.52 0V5.704c0-1.292-.401-2.331-1.061-3.04-.655-.703-1.62-1.143-2.882-1.143H5.852c-1.257 0-2.223.44-2.879 1.143-.661.71-1.063 1.75-1.063 3.04v7.814c0 1.291.4 2.33 1.06 3.04.654.702 1.62 1.142 2.882 1.142h1.722a.76.76 0 1 1 0 1.521H5.852c-1.637 0-3.023-.583-3.995-1.627C.89 16.556.389 15.124.389 13.518V5.704c0-1.607.504-3.039 1.472-4.077z"
                fill="currentColor"
                style={{ strokeWidth: "1.05623" }}
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3.575 4.25c0-.42.34-.76.76-.76h.066a.76.76 0 1 1 0 1.52h-.065a.76.76 0 0 1-.76-.76zm2.586 0c0-.42.34-.76.76-.76h.065a.76.76 0 1 1 0 1.52h-.065a.76.76 0 0 1-.76-.76zm2.586 0c0-.42.34-.76.76-.76h.065a.76.76 0 0 1 0 1.52h-.065a.76.76 0 0 1-.76-.76zM.389 7.141c0-.42.34-.76.76-.76h17.702a.76.76 0 0 1 0 1.52H1.149a.76.76 0 0 1-.76-.76z"
                fill="currentColor"
                style={{ strokeWidth: "1.05623" }}
              />
              <path
                clipRule="evenodd"
                d="m16.914 16.791-1.93.433a.218.218 0 0 0-.137.095l-.93 1.454c-.452.708-1.535.517-1.719-.302l-1.037-5.153c-.184-.823.717-1.456 1.427-1.005l4.625 2.758c.711.45.522 1.536-.299 1.72z"
                stroke="currentColor"
                strokeWidth="1.584"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>{" "}
            <span className="link-text">SmythOS app</span>
            <svg
              className="icon-right"
              width={20}
              height={20}
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>{" "}
          </a>
        </li>
        <li className="menu-label" role="none">
          Community
        </li>
        <li role="none">
          <a
            href="https://discord.gg/smythos"
            role="menuitem"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              width={20}
              height={20}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5.674.77h8.651c3.024 0 4.906 2.134 4.906 5.154v8.151c0 3.021-1.882 5.156-4.907 5.156h-8.65c-3.024 0-4.905-2.135-4.905-5.156v-8.15C.77 2.903 2.66.768 5.674.768z"
                stroke="currentColor"
                strokeWidth="1.538"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8.337 9.994v.037m.153-.03a.154.154 0 1 1-.308 0 .154.154 0 0 1 .308 0zM11.665 9.994v.037m.153-.03a.154.154 0 1 1-.308 0 .154.154 0 0 1 .308 0z"
                stroke="currentColor"
                strokeWidth="1.538"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8.306 5.705a9.979 9.979 0 0 0-2.045.582 1.059 1.059 0 0 0-.51.44 10.035 10.035 0 0 0-1.345 6.085c.073.718.9 1.053 1.52 1.305l.193.079c.974.414 1.44-.621 1.752-1.332 1.402.31 2.856.31 4.258 0 .311.711.778 1.746 1.752 1.332.06-.026.125-.052.192-.079.621-.252 1.448-.587 1.52-1.305.21-2.12-.261-4.251-1.344-6.085a1.059 1.059 0 0 0-.51-.44 9.977 9.977 0 0 0-2.045-.582l-.522.598H8.828Z"
                stroke="currentColor"
                strokeWidth="1.538"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>{" "}
            <span className="link-text">Discord</span>
            <svg
              className="icon-right"
              width={20}
              height={20}
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5.83325 14.1667L14.1666 5.83333M14.1666 5.83333H7.49992M14.1666 5.83333V12.5"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>{" "}
          </a>
        </li>
      </ul>
    </nav>
  </div>
  <div className="navbar"></div>
</>
  );
};

export default HeaderComponent;