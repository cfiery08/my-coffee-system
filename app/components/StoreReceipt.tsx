"use client";

import Image from "next/image";
import styles from "./StoreReceipt.module.css";

export type ReceiptOrder = {
  id: string;
  created_at: string;
  order_type: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal?: number;
  delivery_fee?: number;
  total_amount: number;
  table_number: string | null;
  customer_name: string | null;
  contact_number?: string | null;
  customer_email?: string | null;
  delivery_address?: string | null;
  notes?: string | null;
  order_items: { id: string; menu_item_name: string; quantity: number; unit_price: number; subtotal: number }[];
};

const peso = (amount: number) => `₱${Number(amount || 0).toFixed(2)}`;

export default function StoreReceipt({ order, onClose }: { order: ReceiptOrder; onClose: () => void }) {
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={`Receipt for order ${order.id.slice(0, 8)}`}>
        <div className={styles.actions}><button type="button" onClick={() => window.print()} className={styles.print}>Print receipt</button><button type="button" onClick={onClose} className={styles.close}>Close</button></div>
        <article className={styles.receipt}>
          <header className={styles.brand}>
            <Image src="/brewora_logo.png" alt="Brewora Coffee Shop" width={270} height={68} className={styles.logo} priority />
          </header>
          <div className={styles.rule} />
          <div className={styles.receiptTitle}>ORDER RECEIPT</div>
          <div className={styles.meta}><span>Receipt no.</span><strong>#{order.id.slice(0, 8).toUpperCase()}</strong></div>
          <div className={styles.meta}><span>Date</span><strong>{new Date(order.created_at).toLocaleString()}</strong></div>
          <div className={styles.meta}><span>Order</span><strong>{order.order_type === "delivery" ? "Delivery" : order.order_type === "pickup" ? "Pickup" : order.order_type === "dine_in" ? `Dine in${order.table_number ? ` · Table ${order.table_number}` : ""}` : "Takeout"}</strong></div>
          <div className={styles.meta}><span>Customer</span><strong>{order.customer_name || "Guest"}</strong></div>
          {order.contact_number && <div className={styles.meta}><span>Contact</span><strong>{order.contact_number}</strong></div>}
          {order.customer_email && <div className={styles.meta}><span>Email</span><strong>{order.customer_email}</strong></div>}
          {order.delivery_address && <div className={styles.meta}><span>Address</span><strong>{order.delivery_address}</strong></div>}
          <div className={styles.rule} />
          <div className={styles.itemsHead}><span>ITEM</span><span>AMOUNT</span></div>
          {order.order_items.map((item) => <div className={styles.item} key={item.id}><div><strong>{item.menu_item_name}</strong><small>{item.quantity} × {peso(item.unit_price)}</small></div><strong>{peso(item.subtotal)}</strong></div>)}
          <div className={styles.rule} />
          <div className={styles.meta}><span>Subtotal</span><strong>{peso(order.subtotal ?? order.total_amount)}</strong></div>
          {(order.delivery_fee ?? 0) > 0 && <div className={styles.meta}><span>Delivery</span><strong>{peso(order.delivery_fee!)}</strong></div>}
          <div className={styles.total}><span>TOTAL</span><strong>{peso(order.total_amount)}</strong></div>
          <div className={styles.meta}><span>Payment</span><strong>{(order.payment_method || "—").toUpperCase()}</strong></div>
          <div className={styles.meta}><span>Payment status</span><strong>{order.payment_status === "paid" ? "PAID" : ["cash", "cod", "cash_on_delivery"].includes((order.payment_method || "").toLowerCase().replace(/[\s-]+/g, "_")) ? "DUE AT HANDOFF" : "PAYMENT PENDING"}</strong></div>
          {order.notes && <p className={styles.note}>{order.notes}</p>}
          <footer className={styles.thanks}>We appreciate your visit.<br />Have a lovely day!</footer>
        </article>
      </section>
    </div>
  );
}
