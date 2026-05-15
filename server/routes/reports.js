import { Router } from 'express';
import PDFDocument from 'pdfkit';
import Session from '../models/Session.js';
import RawTransaction from '../models/RawTransaction.js';
import { validateSession } from '../middleware/validateSession.js';

const router = Router();

/**
 * POST /api/reports/:sessionId/generate
 * Generates and streams a PDF report directly to the response.
 */
router.post('/:sessionId/generate', validateSession, async (req, res) => {
  try {
    const session = req.validatedSession;
    const { sessionId, filename, rowCount, insights } = session;

    if (!insights || (!insights.generatedAt && !insights.summary && !insights.topCategories)) {
      return res.status(400).json({ error: 'Insights are not yet generated for this session.' });
    }

    const generatedDate = insights.generatedAt || session.uploadedAt || new Date();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="financial-report-${sessionId.slice(0, 8)}.pdf"`
    );

    // Create a document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Pipe its output currently to the response
    doc.pipe(res);

    // ── SECTION 1 — Cover / Header ───────────────────────────
    doc.fontSize(24).font('Helvetica-Bold').text('Financial Analysis Report');
    doc.fontSize(12).font('Helvetica').fillColor('#666666')
       .text(`${filename}  •  ${rowCount} transactions`);
    doc.text(`Generated: ${generatedDate.toLocaleDateString('en-IN')}`);
    doc.moveDown(2);

    // ── SECTION 2 — Executive Summary ────────────────────────
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text('Executive Summary');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(insights.summary || 'No summary available.');
    doc.moveDown(1.5);

    // ── SECTION 3 — Income vs Expense ────────────────────────
    if (insights.incomeVsExpense) {
      const { totalIncome, totalExpense, netFlow } = insights.incomeVsExpense;
      doc.fontSize(16).font('Helvetica-Bold').text('Cash Flow Overview');
      doc.moveDown(0.5);
      
      const formatCurr = (val) => `₹${Math.abs(val).toLocaleString('en-IN')}`;
      
      doc.fontSize(11).font('Helvetica').text(`Total Income:  ${formatCurr(totalIncome)}`);
      doc.text(`Total Expense: ${formatCurr(totalExpense)}`);
      
      doc.font('Helvetica-Bold').fillColor(netFlow >= 0 ? '#1D9E75' : '#E24B4A');
      doc.text(`Net Flow:      ${netFlow >= 0 ? '+' : '-'}${formatCurr(netFlow)}`);
      doc.fillColor('#000000');
      doc.moveDown(1.5);
    }

    // ── SECTION 4 — Top Spending Categories ──────────────────
    if (insights.topCategories && insights.topCategories.length > 0) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Spending by Category');
      doc.moveDown(1);
      
      const maxSpend = Math.max(...insights.topCategories.map((c) => Math.abs(c.totalSpent)));
      
      insights.topCategories.forEach((cat) => {
        const spend = Math.abs(cat.totalSpent);
        const percent = Math.round((spend / maxSpend) * 100);
        
        doc.fontSize(10).font('Helvetica-Bold').text(cat._id || 'Uncategorized');
        
        const barWidth = 300 * (spend / maxSpend);
        if (barWidth > 0) {
          doc.rect(doc.x, doc.y + 2, barWidth, 12).fill('#6c63ff');
        }
        
        doc.fillColor('#666666').font('Helvetica');
        doc.text(`₹${spend.toLocaleString('en-IN')} (${cat.transactionCount} txns)`, doc.x + barWidth + 10, doc.y + 3);
        doc.fillColor('#000000');
        doc.moveDown(1.5);
      });
    }

    // ── SECTION 6 — Recurring Merchants ──────────────────────
    if (insights.recurringMerchants && insights.recurringMerchants.length > 0) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Recurring Merchants');
      doc.moveDown(1);
      
      insights.recurringMerchants.forEach((m) => {
        doc.fontSize(11).font('Helvetica-Bold').text(m._id);
        doc.fontSize(10).font('Helvetica').fillColor('#666666')
           .text(`${m.count} transactions • Avg ₹${Math.round(Math.abs(m.avgAmount)).toLocaleString('en-IN')} • Total ₹${Math.abs(m.totalSpent).toLocaleString('en-IN')}`);
        doc.fillColor('#000000').moveDown(0.5);
      });
    }

    // ── SECTION 5 — Transaction Table (Paginated) ────────────
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Transaction History');
    doc.moveDown(1);

    const unusualMap = new Map();
    if (insights.unusualTransactions) {
      insights.unusualTransactions.forEach(u => unusualMap.set(u._id.toString(), true));
    }

    const txns = await RawTransaction.find({ sessionId }).sort({ rowIndex: 1 }).lean();
    
    const tableTop = doc.y;
    let currentY = tableTop;
    const rowHeight = 20;

    // Headers
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Date', 50, currentY, { width: 70 });
    doc.text('Description', 120, currentY, { width: 200 });
    doc.text('Category', 330, currentY, { width: 100 });
    doc.text('Amount', 440, currentY, { width: 80, align: 'right' });
    
    currentY += rowHeight;
    doc.moveTo(50, currentY - 5).lineTo(545, currentY - 5).stroke('#cccccc');

    doc.font('Helvetica');
    txns.forEach((t) => {
      if (currentY > 750) {
        doc.addPage();
        currentY = 50;
      }

      const isUnusual = unusualMap.has(t._id.toString());
      if (isUnusual) {
        doc.rect(50, currentY - 2, 495, rowHeight).fill('#fff3cd');
        doc.fillColor('#000000');
      }

      const dateStr = t.normalizedDate ? new Date(t.normalizedDate).toLocaleDateString('en-IN') : 'N/A';
      const desc = (t.merchantName || t.rawData.Description || t.rawData.Particulars || '').slice(0, 35);
      const cat = (t.category || 'Unknown').slice(0, 15);
      const amtStr = `${t.direction === 'credit' ? '+' : '-'}₹${Math.abs(t.normalizedAmount).toLocaleString('en-IN')}`;

      doc.fontSize(8);
      doc.text(dateStr, 50, currentY, { width: 70 });
      doc.text(desc, 120, currentY, { width: 200 });
      doc.text(cat, 330, currentY, { width: 100 });
      
      doc.fillColor(t.direction === 'credit' ? '#1D9E75' : '#E24B4A');
      doc.text(amtStr, 440, currentY, { width: 80, align: 'right' });
      doc.fillColor('#000000');

      currentY += rowHeight;
    });

    // ── SECTION 7 — Footer on every page ─────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#999999');
      doc.text(
        `Page ${i + 1} of ${range.count}`,
        0,
        doc.page.height - 30,
        { align: 'center' }
      );
    }

    doc.end();
  } catch (err) {
    console.error('❌ PDF export error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF report' });
    }
  }
});

export default router;
