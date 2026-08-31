import { HomePage } from "./home_page";
import { CategoriesPage } from "./categories_page";
import { AboutUs } from "./aboutus";
import { ContactUs } from "./contact";
import ProductCards from "./products";
import ProductDetail from "./product_detail";
import { Route, Routes } from "react-router-dom";
import { Buy } from "./buy";
import { CheckLogin } from "./checklogin";
import { Cart } from "./cart";
import UserNavbar from "./navbar";


import OrderCompleted from "./order_completed";
import { Login } from "./login";
import { Register } from "./register";
import { AdminDashboard } from "../admin/AdminDashboard";
import { FAQ } from "./faq";
import { Shipping } from "./shipping";
import { Returns } from "./returns";
import Checkout from "./checkout";
import { Account } from "./account";

export function User() {
  return (
    <div>
      <UserNavbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/categories" element={<CategoriesPage />} />

        {/* Dynamic Routes */}
        <Route path="/category/:categoryId" element={<ProductCards />} />
        <Route path="/category/:categoryId/product/:productId" element={<ProductDetail />} />

        <Route path="/buy" element={<Buy />} />
        <Route path="/checklogin" element={<CheckLogin />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-completed" element={<OrderCompleted />} />
        <Route path="/account" element={<Account />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/shipping" element={<Shipping />} />
        <Route path="/returns" element={<Returns />} />
      </Routes>
    </div>
  );
}
