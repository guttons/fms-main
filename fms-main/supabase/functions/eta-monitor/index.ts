// Supabase Edge Function: eta-monitor
// Invoked on schedule (every minute) via Supabase pg_cron or HTTP webhook.
// Deno TypeScript environment.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

interface WebPushPayload {
  title: string;
  body: string;
  alertType: string;
  flightNumber: string;
  metadata: any;
  urgency: 'normal' | 'high';
  url: string;
}

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const bigQueryApiUrl = Deno.env.get('BIGQUERY_API_URL') || 'https://fms-bigquery-api-808402455416.us-central1.run.app';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Supabase credentials missing' }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch active flight jobs that have assigned staff
    const { data: jobs, error: jobsError } = await supabase
      .from('flight_jobs')
      .select('*')
      .neq('status', 'COMPLETED')
      .neq('status', 'CANCELED');

    if (jobsError) {
      return new Response(JSON.stringify({ error: jobsError.message }), { status: 500 });
    }

    const now = new Date();
    const alertsToSend: any[] = [];
    const jobUpdates: { id: string; fields: any }[] = [];

    for (const job of (jobs || [])) {
      if (!job.assigned_to && !job.assigned_officer && !job.assignedTo && !job.assignedOfficer) {
        continue;
      }

      const assignedTo = job.assigned_to || job.assignedTo;
      const assignedOfficer = job.assigned_officer || job.assignedOfficer;
      const timeStr = job.eta || job.sta;
      if (!timeStr) continue;

      const [hoursStr, minutesStr] = timeStr.split(':');
      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      if (isNaN(hours) || isNaN(minutes)) continue;

      const targetTime = new Date(now);
      targetTime.setHours(hours, minutes, 0, 0);

      const diffMs = targetTime.getTime() - now.getTime();
      const diffMins = diffMs / 60000;

      const eta15Sent = job.eta_alert_15_sent || false;
      const eta5Sent = job.eta_alert_5_sent || false;

      const metadata = {
        aircraftReg: job.aircraft_reg || job.aircraftReg,
        stand: job.stand,
        eta: timeStr,
        flightNumber: job.flight_number || job.flightNumber
      };

      // 15-minute alert
      if (diffMins <= 15.5 && diffMins > 5.5 && !eta15Sent) {
        if (assignedTo) {
          alertsToSend.push({
            alert_type: 'ETA_15MIN',
            severity: 'medium',
            flight_number: metadata.flightNumber,
            message: `⏰ ETA WARNING: Flight ${metadata.flightNumber} arriving in ~15 minutes at Stand ${metadata.stand || 'TBA'}`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            target_role: 'ITP_OPERATOR',
            assigned_staff_id: assignedTo,
            metadata
          });
        }
        if (assignedOfficer && assignedOfficer !== assignedTo) {
          alertsToSend.push({
            alert_type: 'ETA_15MIN',
            severity: 'medium',
            flight_number: metadata.flightNumber,
            message: `⏰ ETA WARNING: Flight ${metadata.flightNumber} arriving in ~15 minutes at Stand ${metadata.stand || 'TBA'}`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            target_role: 'ITP_OFFICER',
            assigned_staff_id: assignedOfficer,
            metadata
          });
        }
        jobUpdates.push({ id: job.id, fields: { eta_alert_15_sent: true } });
      }

      // 5-minute alert
      if (diffMins <= 5.5 && diffMins >= -1 && !eta5Sent) {
        if (assignedTo) {
          alertsToSend.push({
            alert_type: 'ETA_5MIN',
            severity: 'critical',
            flight_number: metadata.flightNumber,
            message: `🚨 ETA CRITICAL: Flight ${metadata.flightNumber} arriving in ~5 minutes at Stand ${metadata.stand || 'TBA'}`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            target_role: 'ITP_OPERATOR',
            assigned_staff_id: assignedTo,
            metadata
          });
        }
        if (assignedOfficer && assignedOfficer !== assignedTo) {
          alertsToSend.push({
            alert_type: 'ETA_5MIN',
            severity: 'critical',
            flight_number: metadata.flightNumber,
            message: `🚨 ETA CRITICAL: Flight ${metadata.flightNumber} arriving in ~5 minutes at Stand ${metadata.stand || 'TBA'}`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            target_role: 'ITP_OFFICER',
            assigned_staff_id: assignedOfficer,
            metadata
          });
        }
        jobUpdates.push({ id: job.id, fields: { eta_alert_5_sent: true } });
      }
    }

    // 2. Insert generated alerts to Supabase
    if (alertsToSend.length > 0) {
      await supabase.from('alerts').insert(alertsToSend);
    }

    // 3. Mark alert sent flags on flight jobs
    for (const update of jobUpdates) {
      await supabase.from('flight_jobs').update(update.fields).eq('id', update.id);
    }

    // 4. Dispatch push notifications via Cloud Run API
    if (alertsToSend.length > 0) {
      const recipientIds = Array.from(new Set(alertsToSend.map(a => a.assigned_staff_id).filter(Boolean)));
      if (recipientIds.length > 0) {
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .in('user_id', recipientIds);

        if (subscriptions && subscriptions.length > 0) {
          for (const alert of alertsToSend) {
            const staffSubs = subscriptions.filter((s: any) => s.user_id === alert.assigned_staff_id);
            if (staffSubs.length > 0) {
              const payload: WebPushPayload = {
                title: alert.alert_type === 'ETA_5MIN' ? '🚨 ETA CRITICAL: ~5 Minutes' : '⏰ ETA WARNING: ~15 Minutes',
                body: alert.message,
                alertType: alert.alert_type,
                flightNumber: alert.flight_number,
                metadata: alert.metadata,
                urgency: alert.severity === 'critical' ? 'high' : 'normal',
                url: '/'
              };

              await fetch(`${bigQueryApiUrl}/api/push/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptions: staffSubs, payload })
              }).catch(e => console.warn('Push send failed in Edge Function:', e));
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkedJobs: jobs?.length || 0,
        alertsCreated: alertsToSend.length
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
