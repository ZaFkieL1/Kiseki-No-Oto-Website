import { shop } from "../../lib/data";

export default function ShopView(): React.ReactElement {
  const inStock = shop.filter((item) => item.stock > 0).length;

  return (
    <div>
      <div className="pane__head">
        <span className="pane__title">Shop</span>
        <span className="jp">ショップ</span>
        <span className="hud pane__count">
          {inStock} of {shop.length} available
        </span>
      </div>

      <div className="stack">
        {shop.map((item) => (
          <div className="entry" key={item.sku}>
            <span className="row__meta entry__date">{item.sku}</span>
            <div>
              <h2 className="entry__name">{item.name}</h2>
              <p className="entry__sub">{item.variant}</p>
            </div>
            <span
              className={`state ${
                item.stock > 0 ? "state--open" : "state--gone"
              }`}
            >
              {item.stock > 0 ? `${item.price} · ${item.stock} left` : "Sold out"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
