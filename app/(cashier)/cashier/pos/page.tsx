"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SystemIcon from "@/app/components/SystemIcon";
import StoreReceipt, { type ReceiptOrder } from "@/app/components/StoreReceipt";
import { useAuth } from "@/lib/AuthContext";
import styles from "./pos.module.css";

const ACCENT = "#7c4a1e";
const peso = (amount: number) => `₱${Number(amount).toFixed(2)}`;

type Category = { id: string; name: string };
type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  is_available: boolean;
  inventory_unavailable: boolean;
};
type RecipeLink = { menu_item_id: string; inventory_id: number; quantity_required: number };
type InventoryStock = { inventory_id: number; quantity: number; status: "available" | "unavailable" | "low_stock" };
type CartItem = MenuItem & { quantity: number };
type OrderType = "dine_in" | "takeout";
type PaymentMethod = "cash" | "gcash";
const TABLE_NUMBERS = Array.from({ length: 30 }, (_, index) => String(index + 1));

export default function CashierPOSPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeQuantityItemId, setActiveQuantityItemId] = useState<string | null>(null);
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [tableNumber, setTableNumber] = useState("");
  const [occupiedTables, setOccupiedTables] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [orderNotes, setOrderNotes] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptOrder | null>(null);

  useEffect(() => {
    let active = true;
    async function loadMenu() {
      const [{ data: categoryRows, error: categoryError }, { data: itemRows, error: itemError }, { data: recipeRows, error: recipeError }, { data: stockRows, error: stockError }] = await Promise.all([
        supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
        supabase.from("menu_items").select("id, name, description, price, image_url, category_id, is_available").order("name"),
        supabase.from("menu_ingredients").select("menu_item_id, inventory_id, quantity_required"),
        supabase.from("inventory").select("inventory_id, quantity, status"),
      ]);
      if (!active) return;
      if (categoryError || itemError || recipeError || stockError) {
        const loadError = categoryError || itemError || recipeError || stockError;
        setError(`${loadError?.message || "Could not load menu availability."}${recipeError || stockError ? " Run the updated store-orders SQL migration in Supabase, then reload." : ""}`);
        setMenuItems([]);
        setLoading(false);
        return;
      }
      setCategories(categoryRows ?? []);
      const stockById = new Map(((stockRows ?? []) as InventoryStock[]).map((stock) => [stock.inventory_id, stock]));
      const links = (recipeRows ?? []) as RecipeLink[];
      const enrichedItems = ((itemRows ?? []) as Omit<MenuItem, "inventory_unavailable">[]).map((item) => ({
        ...item,
        inventory_unavailable: links.some((link) => {
          if (link.menu_item_id !== item.id) return false;
          const stock = stockById.get(link.inventory_id);
          return !stock || stock.status === "unavailable" || Number(stock.quantity) < Number(link.quantity_required);
        }),
      }));
      setMenuItems(enrichedItems);
      setLoading(false);
    }
    void loadMenu();
    const channel = supabase.channel("cashier-menu-availability")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => { void loadMenu(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_ingredients" }, () => { void loadMenu(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => { void loadMenu(); })
      .subscribe();
    const refreshTimer = window.setInterval(() => { void loadMenu(); }, 15000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadOccupiedTables() {
      const { data } = await supabase
        .from("orders")
        .select("table_number, status")
        .eq("order_source", "store")
        .eq("order_type", "dine_in");
      if (!active) return;
      const occupied = [...new Set((data ?? [])
        .filter((order) => order.table_number && !["completed", "delivered", "cancelled"].includes(order.status))
        .map((order) => String(order.table_number)))];
      setOccupiedTables(occupied);
      setTableNumber((current) => {
        if (current && !occupied.includes(current)) return current;
        return TABLE_NUMBERS.find((number) => !occupied.includes(number)) ?? "";
      });
    }
    void loadOccupiedTables();
    const channel = supabase.channel("cashier-table-availability")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { void loadOccupiedTables(); })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, []);

  const filteredItems = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.category_id === activeCategory;
      const matchesSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm) || (item.description ?? "").toLowerCase().includes(searchTerm);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, menuItems, search]);

  const itemCount = cart.reduce((count, item) => count + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  function selectItemForQuantity(item: MenuItem) {
    if (!item.is_available || item.inventory_unavailable) return;
    setError("");
    setSuccess("");
    setActiveQuantityItemId(item.id);
    setDraftQuantity(1);
  }

  function confirmAddItem(item: MenuItem) {
    setCart((current) => {
      const existing = current.find((line) => line.id === item.id);
      return existing
        ? current.map((line) => line.id === item.id ? { ...line, quantity: line.quantity + draftQuantity } : line)
        : [...current, { ...item, quantity: draftQuantity }];
    });
    setActiveQuantityItemId(null);
    setDraftQuantity(1);
  }

  function openConfirmation() {
    setError("");
    if (!cart.length) return setError("Add at least one menu item to start this order.");
    const unavailableLine = cart.find((line) => {
      const currentItem = menuItems.find((item) => item.id === line.id);
      return !currentItem || !currentItem.is_available || currentItem.inventory_unavailable;
    });
    if (unavailableLine) return setError(`${unavailableLine.name} is unavailable now. Clear the order and add available items.`);
    if (orderType === "dine_in" && !tableNumber) return setError("All 30 tables are currently occupied. Choose takeout or try again later.");
    if (orderType === "dine_in" && occupiedTables.includes(tableNumber)) return setError("That table was just assigned to another order. Please choose another table.");
    setConfirmOpen(true);
  }

  async function confirmOrder() {
    if (!user || placing) return;
    const unavailableLine = cart.find((line) => {
      const currentItem = menuItems.find((item) => item.id === line.id);
      return !currentItem || !currentItem.is_available || currentItem.inventory_unavailable;
    });
    if (unavailableLine) {
      setError(`${unavailableLine.name} is unavailable now. Clear the order and add available items.`);
      setConfirmOpen(false);
      return;
    }
    setPlacing(true);
    setError("");
    const placedTableNumber = orderType === "dine_in" ? tableNumber : "";

    const noteParts = [
      orderNotes.trim() ? `Order note: ${orderNotes.trim()}` : "",
    ].filter(Boolean);

    const { data: order, error: orderError } = await supabase.from("orders").insert({
      user_id: null,
      order_type: orderType,
      order_source: "store",
      customer_name: customerName.trim() || null,
      status: "pending",
      payment_method: paymentMethod,
      payment_status: "paid",
      subtotal: total,
      delivery_fee: 0,
      total_amount: total,
      notes: noteParts.join("\n") || null,
      table_number: orderType === "dine_in" ? tableNumber.trim() : null,
      cashier_id: user.id,
    }).select("id, created_at").single();

    if (orderError || !order) {
      setError(orderError?.code === "23505"
        ? "That table was just assigned to another order. Please choose another table."
        : orderError?.message || "Could not create the order. Please try again.");
      setPlacing(false);
      return;
    }

    const { error: itemsError } = await supabase.from("order_items").insert(cart.map((line) => ({
      order_id: order.id,
      menu_item_id: line.id,
      menu_item_name: line.name,
      image_url: line.image_url,
      unit_price: line.price,
      quantity: line.quantity,
      subtotal: Number(line.price) * line.quantity,
    })));

    if (itemsError) {
      // The cashier has no direct delete permission. Keep the empty order
      // visible for admin follow-up instead of claiming the order was placed.
      setError(`Order ${order.id.slice(0, 8).toUpperCase()} was created, but its items could not be saved: ${itemsError.message}`);
      setPlacing(false);
      setConfirmOpen(false);
      return;
    }

    setReceipt({
      id: order.id,
      created_at: order.created_at,
      order_type: orderType,
      status: "pending",
      payment_status: "paid",
      payment_method: paymentMethod,
      subtotal: total,
      delivery_fee: 0,
      total_amount: total,
      table_number: orderType === "dine_in" ? placedTableNumber : null,
      customer_name: customerName.trim() || null,
      notes: noteParts.join("\n") || null,
      order_items: cart.map((line) => ({ id: line.id, menu_item_name: line.name, quantity: line.quantity, unit_price: Number(line.price), subtotal: Number(line.price) * line.quantity })),
    });

    const { error: historyError } = await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: "pending",
      changed_by: user.id,
    });

    setCart([]);
    setCartOpen(false);
    if (placedTableNumber) {
      const nextOccupied = [...new Set([...occupiedTables, placedTableNumber])];
      setOccupiedTables(nextOccupied);
      setTableNumber(TABLE_NUMBERS.find((number) => !nextOccupied.includes(number)) ?? "");
    } else {
      setTableNumber(TABLE_NUMBERS.find((number) => !occupiedTables.includes(number)) ?? "");
    }
    setOrderType("dine_in");
    setCustomerName("");
    setOrderNotes("");
    setPaymentMethod("cash");
    setConfirmOpen(false);
    setSuccess(`Order #${order.id.slice(0, 8).toUpperCase()} placed${historyError ? " (status history could not be recorded)" : ""}.`);
    setPlacing(false);
  }

  if (loading) return <div className={styles.loading}>Loading the store menu…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>IN-STORE POINT OF SALE</p>
          <h1 className={styles.title}>Build a Store Order</h1>
          <p className={styles.subtitle}>Choose items, review the order, then confirm it at the counter.</p>
        </div>
        <div className={styles.headingActions}>
          <div className={styles.steps} aria-label="Order steps">
            <span className={styles.stepActive}><b>1</b> Choose items</span>
            <span className={styles.stepDivider} />
            <span><b>2</b> Review & confirm</span>
          </div>
          <button type="button" className={styles.cartTrigger} onClick={() => setCartOpen(true)} aria-label={`Open current order, ${itemCount} items`}>
            <span className={styles.cartIcon}><SystemIcon name="cart" size={22} />{itemCount > 0 && <b>{itemCount}</b>}</span>
            <span className={styles.cartTriggerText}><strong>Current order</strong><small>{itemCount ? `${itemCount} items · ${peso(total)}` : "No items yet"}</small></span>
            <span className={styles.cartOpenLabel}>Review</span>
          </button>
        </div>
      </div>

      {success && <div role="status" className={styles.successBanner}><SystemIcon name="check" size={17} />{success}</div>}
      {error && <div role="alert" className={styles.errorBanner}>{error}</div>}

      <div className={styles.workspace}>
        <section className={styles.menuPanel} aria-label="Store menu items">
          <div className={styles.menuToolbar}>
            <div className={styles.searchBox}>
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.4-4.4" /></svg>
              <input value={search} onChange={(event) => { setSearch(event.target.value); setActiveQuantityItemId(null); }} placeholder="Search drinks and food" aria-label="Search menu" />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search">×</button>}
            </div>
            <span className={styles.resultCount}>{filteredItems.length} items</span>
          </div>

          <div className={styles.categoryRail} role="tablist" aria-label="Menu categories">
            <button type="button" role="tab" aria-selected={activeCategory === "all"} className={activeCategory === "all" ? styles.categoryActive : styles.category} onClick={() => { setActiveCategory("all"); setActiveQuantityItemId(null); }}>All items</button>
            {categories.map((category) => (
              <button key={category.id} type="button" role="tab" aria-selected={activeCategory === category.id} className={activeCategory === category.id ? styles.categoryActive : styles.category} onClick={() => { setActiveCategory(category.id); setActiveQuantityItemId(null); }}>{category.name}</button>
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <div className={styles.emptyMenu}>
              <span><SystemIcon name="coffee" size={30} /></span>
              <strong>{menuItems.length ? "No matching menu items" : "No available items"}</strong>
              <p>Try another search or category.</p>
            </div>
          ) : (
            <div className={styles.menuGrid}>
              {filteredItems.map((item) => {
                const line = cart.find((entry) => entry.id === item.id);
                const itemUnavailable = !item.is_available || item.inventory_unavailable;
                return (
                  <article key={item.id} className={`${styles.menuCard} ${itemUnavailable ? styles.menuCardUnavailable : ""}`}>
                    <div className={styles.itemImage}>
                      {item.image_url ? <img src={item.image_url} alt="" /> : <SystemIcon name="coffee" size={32} />}
                      {itemUnavailable && <span className={styles.unavailableBadge}>Unavailable</span>}
                      {line && <span className={styles.quantityBadge}>{line.quantity}</span>}
                    </div>
                    <div className={styles.itemInfo}>
                      <div>
                        <h2>{item.name}</h2>
                        {item.description && <p>{item.description}</p>}
                      </div>
                      <div className={styles.itemBuyRow}>
                        <strong>{peso(Number(item.price))}</strong>
                        <div className={styles.itemActions}>
                          {!itemUnavailable && activeQuantityItemId === item.id && (
                            <>
                              <div className={styles.cardQuantity} aria-label={`Choose quantity for ${item.name}`}>
                                <button type="button" onClick={() => setDraftQuantity((quantity) => Math.max(1, quantity - 1))} aria-label={`Decrease ${item.name} quantity`}>−</button>
                                <strong>{draftQuantity}</strong>
                                <button type="button" onClick={() => setDraftQuantity((quantity) => quantity + 1)} aria-label={`Increase ${item.name} quantity`}>+</button>
                              </div>
                              <button type="button" className={styles.quantityConfirm} onClick={() => confirmAddItem(item)} aria-label={`Add ${draftQuantity} ${item.name} to order`} title="Add to order">
                                <SystemIcon name="check" size={15} />
                              </button>
                            </>
                          )}
                          {!itemUnavailable && activeQuantityItemId !== item.id && (
                            <button type="button" className={styles.addButton} onClick={() => selectItemForQuantity(item)} aria-label={`Choose quantity for ${item.name}`}>
                              <span>+</span> Add
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

      </div>

      {cartOpen && <div className={styles.cartBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
        <aside className={styles.ticket} aria-label="Current order" role="dialog" aria-modal="true" aria-labelledby="current-order-title">
          <div className={styles.ticketHeader}>
            <div className={styles.ticketTitleRow}>
              <div>
                <h2 id="current-order-title">Current Order</h2>
                <p>{itemCount ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : "Your order is empty"}</p>
              </div>
              <div className={styles.drawerHeaderActions}>
                {cart.length > 0 && <button type="button" className={styles.clearButton} onClick={() => setCart([])}>Clear order</button>}
                <button type="button" className={styles.drawerClose} onClick={() => setCartOpen(false)} aria-label="Close current order"><SystemIcon name="x" size={20} /></button>
              </div>
            </div>
            <div className={styles.orderTypeSwitch} aria-label="Order type">
              {([{ id: "dine_in", label: "Dine In" }, { id: "takeout", label: "Takeout" }] as const).map((option) => (
                <button key={option.id} type="button" aria-pressed={orderType === option.id} className={orderType === option.id ? styles.orderTypeActive : styles.orderType} onClick={() => {
                  setOrderType(option.id);
                  if (option.id === "takeout") setTableNumber("");
                  else if (!tableNumber || occupiedTables.includes(tableNumber)) setTableNumber(TABLE_NUMBERS.find((number) => !occupiedTables.includes(number)) ?? "");
                }}>
                  {option.id === "dine_in" ? <SystemIcon name="chair" size={15} /> : <SystemIcon name="package" size={15} />}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.ticketLines}>
            {cart.length === 0 ? (
              <div className={styles.emptyTicket}><SystemIcon name="package" size={32} /><span>Tap “Add” on a menu item to begin.</span></div>
            ) : cart.map((line) => (
              <div key={line.id} className={styles.ticketLine}>
                <div className={styles.lineTop}>
                  <div className={styles.lineName}>{line.name}<small>{peso(Number(line.price))} each</small></div>
                  <span className={styles.drawerQuantity}>Qty {line.quantity}</span>
                  <strong>{peso(Number(line.price) * line.quantity)}</strong>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.ticketDetails}>
            <div className={styles.customerFields}>
              {orderType === "dine_in" && <label>
                Table number <span>Required</span>
                <div className={styles.tableAssignment} aria-live="polite">
                  <span className={styles.tableSelectIcon}><SystemIcon name="chair" size={17} /></span>
                  <span className={tableNumber ? styles.tableAssignmentValue : styles.tableAssignmentEmpty}>
                    {tableNumber ? `Table ${tableNumber} · Auto-assigned` : "No tables available"}
                  </span>
                </div>
              </label>}
              <label>
                Customer name <span>Optional</span>
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Walk-in customer" />
              </label>
            </div>

            <label className={styles.paymentLabel}>Payment method</label>
            <div className={styles.paymentOptions}>
              {(["cash", "gcash"] as const).map((method) => (
                <button key={method} type="button" aria-pressed={paymentMethod === method} className={paymentMethod === method ? styles.paymentActive : styles.paymentOption} onClick={() => setPaymentMethod(method)}>
                  {method === "cash" ? "Cash" : "GCash"}
                </button>
              ))}
            </div>

            <label className={styles.orderNoteLabel}>Order note <span>Optional</span></label>
            <textarea value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} rows={2} placeholder="Add a note for this order" />
          </div>

          <div className={styles.ticketFooter}>
            {error && <div role="alert" className={styles.errorBanner}>{error}</div>}
            <div className={styles.ticketTotals}>
              <div className={styles.subtotalRow}><span>Subtotal</span><strong>{peso(total)}</strong></div>
              <div className={styles.totalRow}><span>Total</span><strong>{peso(total)}</strong></div>
            </div>
            <button type="button" className={styles.confirmButton} onClick={openConfirmation} disabled={placing || cart.length === 0}>
              Review Order <span>{peso(total)}</span>
            </button>
          </div>
        </aside>
      </div>}

      {confirmOpen && <div className={styles.modalBackdrop} role="presentation">
        <section className={styles.confirmModal} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className={styles.confirmIcon}><SystemIcon name="package" size={24} /></div>
          <h2 id="confirm-title">Confirm payment received?</h2>
          <p className={styles.paymentReminder}>
            {paymentMethod === "gcash"
              ? "Check the customer's GCash payment in your merchant account before confirming. This will record the order as paid."
              : "Collect the cash at the counter before confirming. This will record the order as paid."}
          </p>
          <p className={styles.confirmType}>{orderType === "dine_in" ? `Dine in · Table ${tableNumber.trim()}` : "Takeout order"}</p>
          <div className={styles.confirmLines}>
            {cart.map((line) => <div key={line.id}><span>{line.quantity} × {line.name}</span><strong>{peso(Number(line.price) * line.quantity)}</strong></div>)}
          </div>
          <div className={styles.confirmTotal}><span>Total · {paymentMethod === "gcash" ? "GCash" : "Cash"}</span><strong>{peso(total)}</strong></div>
          {error && <p role="alert" className={styles.modalError}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.backButton} onClick={() => setConfirmOpen(false)} disabled={placing}>Back to order</button>
            <button type="button" className={styles.placeButton} onClick={confirmOrder} disabled={placing}>{placing ? "Saving…" : "Confirm Paid & Place"}</button>
          </div>
        </section>
      </div>}
      {receipt && <StoreReceipt order={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
