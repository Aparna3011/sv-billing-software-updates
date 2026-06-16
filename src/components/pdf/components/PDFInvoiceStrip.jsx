import {
  View,
  Text,
} from '@react-pdf/renderer';

import { pdfStyles }
from '../pdfStyles';

export default function PDFInvoiceStrip({
  document = {},
}) {

  const total =
    Math.round(
      Number(
        document.grand_total || 0
      )
    );

  const paidNow =
    Math.round(
      Number(
        document.paid_now ||
        document.current_payment ||
        0
      )
    );

  const totalPaid =
    Math.round(
      Number(
        document.paid_amount || 0
      )
    );

  const due =
    Math.round(
      Number(
        document.balance_due || 0
      )
    );

  return (

    <View
      style={
        pdfStyles.invoiceStrip
      }
    >

      <Text
        style={
          pdfStyles.stripText
        }
      >
        Total: Rs {total}
      </Text>

      <Text
        style={
          pdfStyles.stripText
        }
      >
        Paid Now : Rs {paidNow}
      </Text>

      <Text
        style={
          pdfStyles.stripText
        }
      >
        Total Paid: Rs {totalPaid}
      </Text>

      <Text
        style={
          pdfStyles.stripText
        }
      >
        Due: Rs {due}
      </Text>

    </View>

  );

}