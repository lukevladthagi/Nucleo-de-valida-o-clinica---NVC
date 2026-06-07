import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();

    // Total today
    const totalRows = await sql`
      SELECT COUNT(*)::int AS cnt FROM requests WHERE created_at >= ${todayStr}
    `;

    // Pending (aguardando validação)
    const pendingRows = await sql`
      SELECT COUNT(*)::int AS cnt FROM requests 
      WHERE LOWER(status) LIKE '%aguardando%'
    `;

    // Approved
    const approvedRows = await sql`
      SELECT COUNT(*)::int AS cnt FROM requests 
      WHERE LOWER(status) = 'aprovada' AND created_at >= ${todayStr}
    `;

    // Denied
    const deniedRows = await sql`
      SELECT COUNT(*)::int AS cnt FROM requests 
      WHERE LOWER(status) = 'negada' AND created_at >= ${todayStr}
    `;

    // SLA expired
    const slaExpiredRows = await sql`
      SELECT COUNT(*)::int AS cnt FROM requests 
      WHERE is_sla_expired = 1 AND LOWER(status) LIKE '%aguardando%'
    `;

    // Average response time (for decided requests today)
    const avgTimeRows = await sql`
      SELECT 
        COALESCE(
          ROUND(AVG(
            EXTRACT(EPOCH FROM (decision_at::timestamp - created_at::timestamp)) / 60
          ))::int,
          0
        ) AS avg_minutes
      FROM requests
      WHERE decision_at IS NOT NULL AND created_at >= ${todayStr}
    `;

    // Fast-track (imediata priority pending)
    const fastTrackRows = await sql`
      SELECT COUNT(*)::int AS cnt FROM requests 
      WHERE LOWER(priority_classification) = 'imediata' 
        AND LOWER(status) LIKE '%aguardando%'
    `;

    const avgMinutes = avgTimeRows[0]?.avg_minutes || 0;
    const hours = Math.floor(avgMinutes / 60);
    const mins = avgMinutes % 60;
    const avgTimeFormatted =
      avgMinutes > 0
        ? `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
        : '--:--';

    return NextResponse.json({
      today_total: totalRows[0]?.cnt || 0,
      pending: pendingRows[0]?.cnt || 0,
      approved: approvedRows[0]?.cnt || 0,
      denied: deniedRows[0]?.cnt || 0,
      sla_expired: slaExpiredRows[0]?.cnt || 0,
      avg_response_time: avgTimeFormatted,
      fast_track: fastTrackRows[0]?.cnt || 0,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Erro ao carregar estatísticas' }, { status: 500 });
  }
}
