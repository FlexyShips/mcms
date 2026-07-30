export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'MCDMS API',
    version: '1.0.0',
    description: 'Swagger documentation for the MCDMS backend API.',
  },
  tags: [
    {
      name: 'Health',
      description: 'Service health and readiness checks',
    },
    {
      name: 'Waitlist',
      description: 'Join Flexy Ship wait list',
    },
    {
      name: 'Signup',
      description: 'Tenant signup and onboarding',
    },
    {
      name: 'Auth',
      description: 'Authentication, session, and tenant onboarding',
    },
    {
      name: 'Admin',
      description: 'Super admin tenant and platform management',
    },
    {
      name: 'Subscription',
      description: 'Subscription and billing management',
    },
    {
      name: 'Plan',
      description: 'Subscription plan management',
    },
    {
      name: 'Dashboard',
      description: 'Fleet dashboard summary and metrics',
    },
    {
      name: 'Storage',
      description: 'Direct uploads and signed Cloudinary access',
    },
    {
      name: 'Certificates',
      description: 'Vessel certificate management',
    },
    {
      name: 'Renewals',
      description: 'Renewal workflow management',
    },
    {
      name: 'Notifications',
      description: 'Notification settings, logs, and test delivery',
    },
    {
      name: 'Vessels',
      description: 'Vessel fleet management',
    },
    {
      name: 'Crew',
      description: 'Crew member management and vessel assignment',
    },
    {
      name: 'Users',
      description: 'Tenant user management and invitations',
    },
  ],
  servers: [
    {
      url: 'https://instant-marjorie-chile4coding-469a72b9.koyeb.app/api/v1',
      description: 'Staging server',
    },
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Local development server',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    database: { type: 'string' },
                    redis: { type: 'string' },
                    queues: { type: 'object' },
                    uptime: { type: 'number' },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Degraded service',
          },
        },
      },
    },
    '/waitlist': {
      post: {
        summary: 'Join waitlist',
        tags: ['Waitlist'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  companyName: { type: 'string' },
                  phone: { type: 'string' },
                  fleetSize: { type: 'integer' },
                  notes: { type: 'string' },
                  referral: { type: 'string' },
                },
                required: ['email', 'companyName'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Waitlist entry created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { waitlist: { type: 'object' } },
                },
              },
            },
          },
        },
      },
    },
    '/waitlist/admin': {
      get: {
        summary: 'List waitlist entries',
        tags: ['Waitlist'],
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['PENDING', 'INVITED', 'CONVERTED', 'REJECTED'],
            },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          '200': {
            description: 'Waitlist entries',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/waitlist/admin/{id}/invite': {
      patch: {
        summary: 'Invite waitlist entry',
        tags: ['Waitlist'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Invitation sent',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tenantSlug: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Tokens',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/auth/onboard': {
      post: {
        summary: 'Onboard tenant',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: { type: 'string' },
                  companyName: { type: 'string' },
                  slug: { type: 'string' },
                  adminEmail: { type: 'string', format: 'email' },
                  adminPassword: { type: 'string' },
                  adminFirstName: { type: 'string' },
                  adminLastName: { type: 'string' },
                  phone: { type: 'string' },
                },
                required: [
                  'token',
                  'companyName',
                  'slug',
                  'adminEmail',
                  'adminPassword',
                  'adminFirstName',
                  'adminLastName',
                ],
              },
            },
          },
        },
        responses: { '200': { description: 'Onboarded successfully' } },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Refresh tokens',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { refreshToken: { type: 'string' } },
                required: ['refreshToken'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'New tokens',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Logout',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { refreshToken: { type: 'string' } },
                required: ['refreshToken'],
              },
            },
          },
        },
        responses: { '204': { description: 'Logged out' } },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current user',
        tags: ['Auth'],
        responses: {
          '200': {
            description: 'Current user',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { user: { type: 'object' } },
                },
              },
            },
          },
        },
      },
    },

    '/subscriptions/current': {
      get: {
        summary: 'Get current subscription',
        tags: ['Subscription'],
        responses: {
          '200': {
            description: 'Current subscription details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    subscription: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        planId: { type: 'string' },
                        status: {
                          type: 'string',
                          enum: ['PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED'],
                        },
                        billingCycle: {
                          type: 'string',
                          enum: ['MONTHLY', 'ANNUALLY', 'QUARTERLY', 'BIANNUALLY'],
                        },
                        amount: { type: 'string' },
                        currency: { type: 'string' },
                        currentPeriodStart: {
                          type: 'string',
                          format: 'date-time',
                        },
                        currentPeriodEnd: {
                          type: 'string',
                          format: 'date-time',
                        },
                        cancelAtPeriodEnd: { type: 'boolean' },
                        cancelReason: { type: 'string' },
                        paymentReference: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                        plan: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            description: { type: 'string' },
                            billingCycle: { type: 'string' },
                            amountKobo: { type: 'integer' },
                            currency: { type: 'string' },
                            vesselLimit: { type: 'integer' },
                          },
                        },
                        payments: {
                          type: 'array',
                          items: { type: 'object' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Subscription not found',
          },
        },
      },
    },
    '/subscriptions/initiate': {
      post: {
        summary: 'Initiate subscription',
        tags: ['Subscription'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  planId: { type: 'string' },
                },
                required: ['planId'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Subscription checkout initiated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    checkoutUrl: { type: 'string', format: 'uri' },
                    provider: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid subscription plan',
          },
        },
      },
    },
    '/subscriptions/cancel': {
      post: {
        summary: 'Cancel subscription',
        tags: ['Subscription'],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Subscription cancelled',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'boolean' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Subscription not found',
          },
        },
      },
    },
    '/plan/plans': {
      get: {
        summary: 'List subscription plans',
        tags: ['Plan'],
        responses: {
          '200': {
            description: 'Available plans',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    plans: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          description: { type: 'string' },
                          billingCycle: {
                            type: 'string',
                            enum: ['MONTHLY', 'ANNUALLY', 'QUARTERLY', 'BIANNUALLY'],
                          },
                          amountKobo: { type: 'integer' },
                          currency: { type: 'string' },
                          gatewayPlanId: { type: 'string' },
                          vesselLimit: { type: 'integer' },
                          moduleFleetDashboard: { type: 'boolean' },
                          moduleVesselManagement: { type: 'boolean' },
                          moduleCrewManagement: { type: 'boolean' },
                          moduleExcelMigration: { type: 'boolean' },
                          moduleDocumentRepository: { type: 'boolean' },
                          moduleReporting: { type: 'boolean' },
                          moduleRenewalWorkflow: { type: 'boolean' },
                          moduleNotifications: { type: 'boolean' },
                          moduleAiFeatures: { type: 'boolean' },
                          moduleIntegrations: { type: 'boolean' },
                          createdAt: { type: 'string', format: 'date-time' },
                          updatedAt: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create subscription plan',
        tags: ['Plan'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  billingCycle: {
                    type: 'string',
                    enum: ['MONTHLY', 'ANNUALLY', 'QUARTERLY', 'BIANNUALLY'],
                  },
                  amountKobo: { type: 'integer' },
                  currency: { type: 'string' },
                  modules: {
                    type: 'object',
                    properties: {
                      fleetDashboard: { type: 'boolean' },
                      vesselManagement: { type: 'boolean' },
                      crewManagement: { type: 'boolean' },
                      excelMigration: { type: 'boolean' },
                      documentRepository: { type: 'boolean' },
                      reporting: { type: 'boolean' },
                      renewalWorkflow: { type: 'boolean' },
                      notifications: { type: 'boolean' },
                      aiFeatures: { type: 'boolean' },
                      integrations: { type: 'boolean' },
                    },
                  },
                  vesselLimit: { type: 'integer' },
                },
                required: ['name', 'billingCycle', 'amountKobo'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Plan created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    plan: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        billingCycle: { type: 'string' },
                        amountKobo: { type: 'integer' },
                        currency: { type: 'string' },
                        gatewayPlanId: { type: 'string' },
                        vesselLimit: { type: 'integer' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          '409': {
            description: 'Plan with this name already exists',
          },
        },
      },
    },
    '/plan/plans/{id}': {
      get: {
        summary: 'Get plan details',
        tags: ['Plan'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Plan details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    plan: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        billingCycle: { type: 'string' },
                        amountKobo: { type: 'integer' },
                        currency: { type: 'string' },
                        gatewayPlanId: { type: 'string' },
                        vesselLimit: { type: 'integer' },
                        moduleFleetDashboard: { type: 'boolean' },
                        moduleVesselManagement: { type: 'boolean' },
                        moduleCrewManagement: { type: 'boolean' },
                        moduleExcelMigration: { type: 'boolean' },
                        moduleDocumentRepository: { type: 'boolean' },
                        moduleReporting: { type: 'boolean' },
                        moduleRenewalWorkflow: { type: 'boolean' },
                        moduleNotifications: { type: 'boolean' },
                        moduleAiFeatures: { type: 'boolean' },
                        moduleIntegrations: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Plan not found',
          },
        },
      },
      delete: {
        summary: 'Delete plan',
        tags: ['Plan'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Plan deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Plan not found',
          },
        },
      },
    },
    '/signup': {
      post: {
        summary: 'Create signup',
        tags: ['Signup'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fullName: { type: 'string', maxLength: 200 },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8, maxLength: 128 },
                  companyName: { type: 'string', maxLength: 200 },
                  slug: {
                    type: 'string',
                    maxLength: 80,
                    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
                  },
                  planId: { type: 'string' },
                },
                required: ['fullName', 'email', 'password', 'companyName', 'slug', 'planId'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Signup created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    reference: { type: 'string' },
                    checkoutUrl: { type: 'string', format: 'uri' },
                    provider: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '409': {
            description: 'Email already registered or slug taken',
          },
          '400': {
            description: 'Invalid subscription plan',
          },
        },
      },
    },
    '/signup/slug/{slug}': {
      get: {
        summary: 'Check slug availability',
        tags: ['Signup'],
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              maxLength: 80,
              pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Slug availability',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    available: { type: 'boolean' },
                    suggested: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/signup/status/{reference}': {
      get: {
        summary: 'Get signup status',
        tags: ['Signup'],
        parameters: [
          {
            name: 'reference',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Signup status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['PENDING', 'ACTIVE', 'EXPIRED', 'AWAITING_PAYMENT', 'CANCELLED'],
                    },
                    slug: { type: 'string' },
                    companyName: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Signup not found',
          },
          '410': {
            description: 'Signup has expired',
          },
        },
      },
    },
    '/signup/callback': {
      get: {
        summary: 'Signup callback',
        tags: ['Signup'],
        parameters: [
          {
            name: 'reference',
            in: 'query',
            required: false,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '302': {
            description: 'Redirects to frontend based on signup status',
          },
        },
      },
    },
    '/admin/login': {
      post: {
        summary: 'Super admin login',
        tags: ['Admin'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Super admin authenticated',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/admin/tenants': {
      get: {
        summary: 'List tenants',
        tags: ['Admin'],
        responses: {
          '200': {
            description: 'Tenants list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tenants: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/admin/tenants/{tenantId}': {
      get: {
        summary: 'Get tenant details',
        tags: ['Admin'],
        parameters: [
          {
            name: 'tenantId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Tenant details',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/admin/tenants/{tenantId}/modules': {
      patch: {
        summary: 'Update tenant module settings',
        tags: ['Admin'],
        parameters: [
          {
            name: 'tenantId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  moduleFleetDashboard: { type: 'boolean' },
                  moduleVesselManagement: { type: 'boolean' },
                  moduleCrewManagement: { type: 'boolean' },
                  moduleExcelMigration: { type: 'boolean' },
                  moduleDocumentRepository: { type: 'boolean' },
                  moduleReporting: { type: 'boolean' },
                  moduleRenewalWorkflow: { type: 'boolean' },
                  moduleNotifications: { type: 'boolean' },
                  moduleAiFeatures: { type: 'boolean' },
                  moduleIntegrations: { type: 'boolean' },
                  vesselLimitOverride: { type: 'integer' },
                  storageQuotaMbOverride: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Tenant settings updated',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/admin/tenants/{tenantId}/suspend': {
      patch: {
        summary: 'Suspend tenant',
        tags: ['Admin'],
        parameters: [
          {
            name: 'tenantId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { reason: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Tenant suspended',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/admin/tenants/{tenantId}/reactivate': {
      patch: {
        summary: 'Reactivate tenant',
        tags: ['Admin'],
        parameters: [
          {
            name: 'tenantId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Tenant reactivated',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/admin/tenants/{tenantId}/users': {
      get: {
        summary: 'List tenant users',
        tags: ['Admin'],
        parameters: [
          {
            name: 'tenantId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Tenant users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/admin/tenants/{tenantId}/users/admin': {
      post: {
        summary: 'Create tenant admin',
        tags: ['Admin'],
        parameters: [
          {
            name: 'tenantId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['email', 'firstName', 'lastName', 'password'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Tenant admin created',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/admin/tenants/{tenantId}/transfer-ownership': {
      patch: {
        summary: 'Transfer tenant ownership',
        tags: ['Admin'],
        parameters: [
          {
            name: 'tenantId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { targetUserId: { type: 'string' } },
                required: ['targetUserId'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Ownership transferred',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/admin/tenants/{tenantId}/users/{userId}/deactivate': {
      patch: {
        summary: 'Deactivate tenant user',
        tags: ['Admin'],
        parameters: [
          {
            name: 'tenantId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Tenant user deactivated',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/admin/audit-logs': {
      get: {
        summary: 'List super admin audit logs',
        tags: ['Admin'],
        responses: {
          '200': {
            description: 'Super admin audit logs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    logs: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/dashboard/summary': {
      get: {
        summary: 'Get fleet dashboard summary',
        tags: ['Dashboard'],
        responses: {
          '200': {
            description: 'Dashboard summary',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/storage/presign': {
      post: {
        summary: 'Create Cloudinary presigned upload parameters',
        tags: ['Storage'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  folder: { type: 'string' },
                  publicId: { type: 'string' },
                  resourceType: {
                    type: 'string',
                    enum: ['image', 'raw', 'video'],
                  },
                  originalName: { type: 'string' },
                  mimeType: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Presigned upload credentials',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/vessels/{vesselId}/certificates': {
      get: {
        summary: 'List vessel certificates',
        tags: ['Certificates'],
        parameters: [
          {
            name: 'vesselId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Certificates list',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
      post: {
        summary: 'Create vessel certificate',
        tags: ['Certificates'],
        parameters: [
          {
            name: 'vesselId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category: {
                    type: 'string',
                    enum: [
                      'STATUTORY',
                      'CLASSIFICATION',
                      'OPERATIONAL',
                      'COMPETENCY',
                      'MEDICAL',
                      'TRAVEL_DOCUMENT',
                    ],
                  },
                  issuingAuthority: { type: 'string' },
                  issuedAt: { type: 'string', format: 'date-time' },
                  expiresAt: { type: 'string', format: 'date-time' },
                  notes: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: ['VALID', 'EXPIRING_SOON', 'EXPIRED', 'UNDER_RENEWAL', 'SUSPENDED'],
                  },
                },
                required: ['name', 'category', 'issuingAuthority', 'issuedAt', 'expiresAt'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Certificate created',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/vessels/{vesselId}/certificates/{certId}': {
      get: {
        summary: 'Get vessel certificate',
        tags: ['Certificates'],
        parameters: [
          {
            name: 'vesselId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'certId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Certificate details',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
      patch: {
        summary: 'Update vessel certificate',
        tags: ['Certificates'],
        parameters: [
          {
            name: 'vesselId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'certId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category: {
                    type: 'string',
                    enum: [
                      'STATUTORY',
                      'CLASSIFICATION',
                      'OPERATIONAL',
                      'COMPETENCY',
                      'MEDICAL',
                      'TRAVEL_DOCUMENT',
                    ],
                  },
                  issuingAuthority: { type: 'string' },
                  issuedAt: { type: 'string', format: 'date-time' },
                  expiresAt: { type: 'string', format: 'date-time' },
                  notes: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: ['VALID', 'EXPIRING_SOON', 'EXPIRED', 'UNDER_RENEWAL', 'SUSPENDED'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Certificate updated',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
      delete: {
        summary: 'Delete vessel certificate',
        tags: ['Certificates'],
        parameters: [
          {
            name: 'vesselId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'certId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { '204': { description: 'Certificate deleted' } },
      },
    },
    '/vessels/{vesselId}/certificates/{certId}/upload': {
      post: {
        summary: 'Attach a file to a vessel certificate',
        tags: ['Certificates'],
        parameters: [
          {
            name: 'vesselId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'certId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fileUrl: { type: 'string', format: 'uri' },
                  fileKey: { type: 'string' },
                  mimeType: { type: 'string' },
                  sizeBytes: { type: 'integer' },
                },
                required: ['fileUrl', 'fileKey'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Certificate file attached',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/renewals': {
      get: {
        summary: 'List renewal items',
        tags: ['Renewals'],
        parameters: [
          { name: 'stage', in: 'query', schema: { type: 'string' } },
          { name: 'assignedTo', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Renewal items',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
      post: {
        summary: 'Create a renewal item',
        tags: ['Renewals'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  certificateId: { type: 'string' },
                  dueDate: { type: 'string', format: 'date-time' },
                  assignedTo: { type: 'string' },
                  notes: { type: 'string' },
                },
                required: ['certificateId'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Renewal created',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/renewals/kanban': {
      get: {
        summary: 'Get renewal kanban board',
        tags: ['Renewals'],
        responses: {
          '200': {
            description: 'Renewals grouped by stage',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/renewals/{id}': {
      get: {
        summary: 'Get renewal details',
        tags: ['Renewals'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Renewal details',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/renewals/{id}/stage': {
      patch: {
        summary: 'Advance renewal stage',
        tags: ['Renewals'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nextStage: {
                    type: 'string',
                    enum: [
                      'EXPIRY_IDENTIFIED',
                      'DOCUMENTS_REQUESTED',
                      'SUBMITTED_TO_AUTHORITY',
                      'UNDER_SURVEY',
                      'APPROVED',
                      'CLOSED',
                    ],
                  },
                  comment: { type: 'string' },
                },
                required: ['nextStage'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Stage updated',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/renewals/{id}/comments': {
      post: {
        summary: 'Add a renewal comment',
        tags: ['Renewals'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { comment: { type: 'string' } },
                required: ['comment'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Comment added',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/notifications/config': {
      get: {
        summary: 'Get notification configuration',
        tags: ['Notifications'],
        responses: {
          '200': {
            description: 'Notification settings',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
      patch: {
        summary: 'Update notification configuration',
        tags: ['Notifications'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  emailNotificationsEnabled: { type: 'boolean' },
                  smsNotificationsEnabled: { type: 'boolean' },
                  whatsappNotificationsEnabled: { type: 'boolean' },
                  alertDays: { type: 'array', items: { type: 'integer' } },
                  digestMode: { type: 'boolean' },
                  digestSendTime: { type: 'string' },
                  additionalAlertEmails: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Notification settings updated',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/notifications/logs': {
      get: {
        summary: 'List recent notification logs',
        tags: ['Notifications'],
        responses: {
          '200': {
            description: 'Notification logs',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/notifications/test': {
      post: {
        summary: 'Send a notification test',
        tags: ['Notifications'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  recipient: { type: 'string', format: 'email' },
                  channel: {
                    type: 'string',
                    enum: ['email', 'sms', 'whatsapp'],
                  },
                },
                required: ['recipient'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Test notification queued',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/vessels': {
      get: {
        summary: 'List vessels',
        tags: ['Vessels'],
        responses: {
          '200': {
            description: 'Vessels list',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
      post: {
        summary: 'Create vessel',
        tags: ['Vessels'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  imoNumber: { type: 'string' },
                  vesselType: { type: 'string' },
                  flagState: { type: 'string' },
                  grossTonnage: { type: 'number' },
                  yearBuilt: { type: 'integer' },
                  status: {
                    type: 'string',
                    enum: ['ACTIVE', 'INACTIVE', 'UNDER_REPAIR', 'DECOMMISSIONED'],
                  },
                  assignedSuperintendentId: { type: 'string' },
                },
                required: ['name', 'vesselType', 'flagState'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Vessel created',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/vessels/{id}': {
      get: {
        summary: 'Get vessel details',
        tags: ['Vessels'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Vessel details',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
      patch: {
        summary: 'Update vessel',
        tags: ['Vessels'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  imoNumber: { type: 'string' },
                  vesselType: { type: 'string' },
                  flagState: { type: 'string' },
                  grossTonnage: { type: 'number' },
                  yearBuilt: { type: 'integer' },
                  status: {
                    type: 'string',
                    enum: ['ACTIVE', 'INACTIVE', 'UNDER_REPAIR', 'DECOMMISSIONED'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Vessel updated',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
      delete: {
        summary: 'Delete vessel',
        tags: ['Vessels'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { '204': { description: 'Vessel deleted' } },
      },
    },
    '/vessels/{id}/superintendent': {
      patch: {
        summary: 'Assign vessel superintendent',
        tags: ['Vessels'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { superintendentId: { type: 'string' } },
                required: ['superintendentId'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Superintendent assigned',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/crew': {
      get: {
        summary: 'List crew members',
        tags: ['Crew'],
        responses: {
          '200': {
            description: 'Crew list',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
      post: {
        summary: 'Create crew member',
        tags: ['Crew'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  rank: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  phone: { type: 'string' },
                  nationality: { type: 'string' },
                  passportNumber: { type: 'string' },
                  dateOfBirth: { type: 'string', format: 'date-time' },
                },
                required: ['firstName', 'lastName', 'rank'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Crew member created',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/crew/{id}': {
      get: {
        summary: 'Get crew member details',
        tags: ['Crew'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Crew member details',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
      patch: {
        summary: 'Update crew member',
        tags: ['Crew'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  rank: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  phone: { type: 'string' },
                  nationality: { type: 'string' },
                  passportNumber: { type: 'string' },
                  dateOfBirth: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Crew member updated',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
      delete: {
        summary: 'Delete crew member',
        tags: ['Crew'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { '204': { description: 'Crew member deleted' } },
      },
    },
    '/crew/{id}/assign': {
      post: {
        summary: 'Assign crew member to vessel',
        tags: ['Crew'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  vesselId: { type: 'string' },
                  startDate: { type: 'string', format: 'date-time' },
                  endDate: { type: 'string', format: 'date-time' },
                },
                required: ['vesselId', 'startDate'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Crew assignment created',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/users/accept-invite': {
      post: {
        summary: 'Accept user invitation',
        tags: ['Users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['token', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'User accepted invite',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/users': {
      get: {
        summary: 'List users',
        tags: ['Users'],
        responses: {
          '200': {
            description: 'Users list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Invite user',
        tags: ['Users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  role: {
                    type: 'string',
                    enum: [
                      'ADMIN',
                      'FLEET_MANAGER',
                      'MARINE_SUPERINTENDENT',
                      'HR_MANAGER',
                      'CREW_MEMBER',
                    ],
                  },
                },
                required: ['email', 'firstName', 'lastName', 'role'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'User invited',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/users/{id}/role': {
      patch: {
        summary: 'Update user role',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: {
                    type: 'string',
                    enum: [
                      'ADMIN',
                      'FLEET_MANAGER',
                      'MARINE_SUPERINTENDENT',
                      'HR_MANAGER',
                      'CREW_MEMBER',
                    ],
                  },
                },
                required: ['role'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'User role updated',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/users/{id}/deactivate': {
      patch: {
        summary: 'Deactivate user',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'User deactivated',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/users/{id}/reactivate': {
      patch: {
        summary: 'Reactivate user',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'User reactivated',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/users/{id}/password': {
      patch: {
        summary: 'Reset user password',
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { password: { type: 'string' } },
                required: ['password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Password reset',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
};
