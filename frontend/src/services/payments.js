import api from './api'

export async function createStripeCheckoutSession({ planId, billingCycle }) {
  const response = await api.post('/payments/stripe/create-checkout/', {
    plan_id: planId,
    billing_cycle: billingCycle,
  })
  return response.data
}

export async function createStripeCustomerPortalSession() {
  const response = await api.post('/payments/stripe/customer-portal/')
  return response.data
}

export async function getStripeConfig() {
  const response = await api.get('/payments/stripe/config/')
  return response.data
}

export async function createBkashCheckoutSession({ planId, billingCycle }) {
  const response = await api.post('/payments/bkash/create/', {
    plan_id: planId,
    billing_cycle: billingCycle,
  })
  return response.data
}

export async function getBkashPaymentStatus(paymentId) {
  const response = await api.get(`/payments/bkash/status/${paymentId}/`)
  return response.data
}
