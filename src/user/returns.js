import { FaUndo, FaExclamationTriangle, FaExchangeAlt, FaClipboardList } from "react-icons/fa";
import "./aboutus.css";

export function Returns() {
  return (
    <div className="page">
      <div className="page__hero">
        <div className="page__hero-inner">
          <span className="page__label">Peace of Mind</span>
          <h1 className="page__title">Returns & Refunds</h1>
          <p className="page__subtitle">
            Our commitment to your complete satisfaction.
          </p>
        </div>
      </div>

      <div className="page__body page__body--narrow">
        <div className="prose">
          <div className="prose__block">
            <h3><FaUndo /> Return Policy</h3>
            <p>
              We accept returns up to 7 days after delivery, provided the item is unused and in
              its original condition. We will refund the full order amount minus the return
              shipping costs.
            </p>
          </div>

          <div className="prose__block">
            <h3><FaExclamationTriangle /> Damaged Items</h3>
            <p>
              If your order arrives damaged in any way, please email us as soon as possible with
              your order number and a photo of the item's condition. We handle these on a
              case-by-case basis and will work towards a satisfactory solution.
            </p>
          </div>

          <div className="prose__block">
            <h3><FaExchangeAlt /> Exchanges</h3>
            <p>
              We replace items if they are defective or damaged. If you need to exchange an item
              for the same product, please contact our customer service team.
            </p>
          </div>

          <div className="prose__block">
            <h3><FaClipboardList /> How to Return</h3>
            <p>
              To initiate a return, please contact us. If your return is accepted, we'll send you
              instructions on how and where to send your package. Items sent back without first
              requesting a return will not be accepted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
