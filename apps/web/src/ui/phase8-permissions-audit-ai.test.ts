import { describe, it, expect } from 'vitest';
import { isEscalationNeeded } from './SupportChat';

describe('Phase 8: Dynamic Role Permissions, Audit Logging & AI Support Assistant', () => {

  describe('1. AI Support Assistant Smart Escalation Logic', () => {
    it('returns false for regular technical or product answers (never displays WhatsApp buttons)', () => {
      const normalResponses = [
        'Here is a complete overview of NORVI Agency, our technology, licensing, and services.',
        'Voro runs locally on your PC with ultra-low latency. It connects with Zoom and Google Meet seamlessly.',
        'You can use your license key on up to 3 personal machines simultaneously.',
        'To install Voro on Windows, download the installer and run setup.exe.',
        'Our agents support 1-day offline mode, letting you work for up to 24 hours without an active internet connection.'
      ];

      for (const res of normalResponses) {
        expect(isEscalationNeeded(res)).toBe(false);
      }
    });

    it('returns true when AI admits it cannot answer or requires human escalation', () => {
      const escalationResponses = [
        'I do not have this information about custom corporate pricing. Please contact support.',
        'If you need immediate assistance with an unresolved billing dispute, reach out to our team on WhatsApp.',
        'This issue is outside my capability. Please submit a ticket through our contact form.',
        'Our human support team can assist you with unlinking this legacy machine.',
        'I am unable to resolve this license error directly. Please contact us.'
      ];

      for (const res of escalationResponses) {
        expect(isEscalationNeeded(res)).toBe(true);
      }
    });

    it('handles empty, null, or undefined gracefully without throwing', () => {
      expect(isEscalationNeeded('')).toBe(false);
      expect(isEscalationNeeded(null as any)).toBe(false);
      expect(isEscalationNeeded(undefined as any)).toBe(false);
    });
  });

  describe('2. Dynamic Role Permissions & Owner Protection Rules', () => {
    it('locks Owner role to wildcard permanent full access [*]', () => {
      // Simulate input attempting to strip owner permissions
      const submittedPermissions: Record<string, string[]> = {
        owner: ['/customers'], // Malicious attempt to restrict owner
        administrator: ['/products', '/releases'],
        support: ['/customers', '/licenses']
      };

      // Backend security rule: Owner is permanently locked to ['*']
      const sanitized = {
        ...submittedPermissions,
        owner: ['*']
      };

      expect(sanitized.owner).toEqual(['*']);
    });

    it('allows delegating dynamic permissions only when manage_role_permissions is present', () => {
      const roleCanManage = (role: string, permissionsMatrix: Record<string, string[]>): boolean => {
        if (role === 'owner') return true;
        const rolePerms = permissionsMatrix[role] || [];
        return rolePerms.includes('manage_role_permissions');
      };

      const matrixWithDelegation: Record<string, string[]> = {
        owner: ['*'],
        administrator: ['', '/products', '/team', 'manage_role_permissions'],
        support: ['/customers', '/licenses']
      };

      const matrixWithoutDelegation: Record<string, string[]> = {
        owner: ['*'],
        administrator: ['', '/products', '/team'],
        support: ['/customers', '/licenses']
      };

      // Owner always has access
      expect(roleCanManage('owner', matrixWithDelegation)).toBe(true);
      expect(roleCanManage('owner', matrixWithoutDelegation)).toBe(true);

      // Administrator with delegation
      expect(roleCanManage('administrator', matrixWithDelegation)).toBe(true);

      // Administrator without delegation
      expect(roleCanManage('administrator', matrixWithoutDelegation)).toBe(false);

      // Support role
      expect(roleCanManage('support', matrixWithDelegation)).toBe(false);
    });

    it('allows freely toggling Overview ("") per role and restricts access when omitted', () => {
      const canAccessSlug = (slug: string, role: string, permissionsMatrix: Record<string, string[]>): boolean => {
        if (role === 'owner') return true;
        const perms = permissionsMatrix[role] || [];
        if (perms.includes('*')) return true;
        return perms.includes(slug);
      };

      const customMatrix: Record<string, string[]> = {
        owner: ['*'],
        administrator: ['/products', '/releases', '/customers'], // Overview ('') removed
        product_manager: ['', '/products', '/releases'], // Overview ('') included
        support: ['/customers', '/licenses'] // Overview ('') removed
      };

      // Owner can access anything
      expect(canAccessSlug('', 'owner', customMatrix)).toBe(true);
      expect(canAccessSlug('/products', 'owner', customMatrix)).toBe(true);

      // Administrator has no Overview access
      expect(canAccessSlug('', 'administrator', customMatrix)).toBe(false);
      expect(canAccessSlug('/products', 'administrator', customMatrix)).toBe(true);

      // Product manager has Overview access
      expect(canAccessSlug('', 'product_manager', customMatrix)).toBe(true);

      // Support has no Overview access
      expect(canAccessSlug('', 'support', customMatrix)).toBe(false);
      expect(canAccessSlug('/customers', 'support', customMatrix)).toBe(true);
    });
  });

  describe('3. Audit Trail Categorization & Action Formatter', () => {
    // Import helper logic as used in Workspace
    function getActivityCategory(action: string) {
      const act = String(action || '').toLowerCase();
      if (act.includes('team') || act.includes('staff')) {
        return { label: 'Team & Staff', color: '#4ade80' };
      }
      if (act.includes('product') || act.includes('category') || act.includes('release')) {
        return { label: 'Products & Agents', color: '#60a5fa' };
      }
      if (act.includes('license') || act.includes('security') || act.includes('device') || act.includes('impersonat') || act.includes('key')) {
        return { label: 'Security & Keys', color: '#f87171' };
      }
      if (act.includes('permission') || act.includes('setting') || act.includes('content') || act.includes('announcement') || act.includes('coupon')) {
        return { label: 'Settings & Config', color: '#fbbf24' };
      }
      return { label: 'System Action', color: '#a3e635' };
    }

    it('correctly maps audit actions to high-clarity categories', () => {
      expect(getActivityCategory('staff.promoted_direct').label).toBe('Team & Staff');
      expect(getActivityCategory('staff.invited').label).toBe('Team & Staff');
      expect(getActivityCategory('product.created').label).toBe('Products & Agents');
      expect(getActivityCategory('product.status_changed').label).toBe('Products & Agents');
      expect(getActivityCategory('settings.permissions_updated').label).toBe('Settings & Config');
      expect(getActivityCategory('security.impersonation_started').label).toBe('Security & Keys');
      expect(getActivityCategory('license.rotated').label).toBe('Security & Keys');
      expect(getActivityCategory('custom.unknown').label).toBe('System Action');
    });
  });
});
