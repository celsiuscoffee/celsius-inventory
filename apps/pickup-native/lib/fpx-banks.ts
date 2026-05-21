// FPX bank codes accepted by Revenue Monster's Direct Payment Checkout
// Mode: FPX. Source: https://doc.revenuemonster.my/docs/bank-code
// Any code not on this list is rejected by RM; keep this in sync if RM
// publishes additions.
export type FpxBank = { code: string; name: string };

export const FPX_BANKS: ReadonlyArray<FpxBank> = [
  { code: "MB2U0227:B2C",  name: "Maybank2U"                },
  { code: "MBB0228:B2C",   name: "Maybank2E"                },
  { code: "BCBB0235:B2C",  name: "CIMB Bank"                },
  { code: "PBB0233:B2C",   name: "Public Bank"              },
  { code: "RHB0218:B2C",   name: "RHB Bank"                 },
  { code: "HLB0224:B2C",   name: "Hong Leong Bank"          },
  { code: "AMBB0209:B2C",  name: "AmBank"                   },
  { code: "BIMB0340:B2C",  name: "Bank Islam"               },
  { code: "BKRM0602:B2C",  name: "Bank Rakyat"              },
  { code: "BMMB0341:B2C",  name: "Bank Muamalat"            },
  { code: "BSN0601:B2C",   name: "Bank Simpanan Nasional"   },
  { code: "ABB0233:B2C",   name: "Affin Bank"               },
  { code: "ABMB0212:B2C",  name: "Alliance Bank"            },
  { code: "AGRO01:B2C",    name: "AGRONet"                  },
  { code: "HSBC0223:B2C",  name: "HSBC"                     },
  { code: "KFH0346:B2C",   name: "Kuwait Finance House"     },
  { code: "OCBC0229:B2C",  name: "OCBC"                     },
  { code: "SCB0216:B2C",   name: "Standard Chartered"       },
  { code: "UOB0226:B2C",   name: "United Overseas Bank"     },
];
