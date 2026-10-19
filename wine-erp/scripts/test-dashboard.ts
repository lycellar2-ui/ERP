import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getDashboardStats, getCashPosition, getARAgingChart, getPLSummary, getPendingApprovalDetails, getMonthlyRevenue } from '../src/app/dashboard/actions';
import { getKpiSummary } from '../src/app/dashboard/kpi/actions';

async function test() {
    console.log('Testing getDashboardStats');
    try { await getDashboardStats(); console.log('OK'); } catch (e) { console.error('Error in getDashboardStats:', e); }

    console.log('Testing getCashPosition');
    try { await getCashPosition(); console.log('OK'); } catch (e) { console.error('Error in getCashPosition:', e); }

    console.log('Testing getARAgingChart');
    try { await getARAgingChart(); console.log('OK'); } catch (e) { console.error('Error in getARAgingChart:', e); }

    console.log('Testing getPLSummary');
    try { await getPLSummary(); console.log('OK'); } catch (e) { console.error('Error in getPLSummary:', e); }

    console.log('Testing getPendingApprovalDetails');
    try { await getPendingApprovalDetails(); console.log('OK'); } catch (e) { console.error('Error in getPendingApprovalDetails:', e); }

    console.log('Testing getMonthlyRevenue');
    try { await getMonthlyRevenue(); console.log('OK'); } catch (e) { console.error('Error in getMonthlyRevenue:', e); }

    console.log('Testing getKpiSummary');
    try { await getKpiSummary(); console.log('OK'); } catch (e) { console.error('Error in getKpiSummary:', e); }

    process.exit(0);
}

test();
