function validatePayoutOrder(activeMemberIds, payoutOrder) {
  if (activeMemberIds.length < 4 || activeMemberIds.length > 20) {
    return "A cycle needs between 4 and 20 active members.";
  }

  if (payoutOrder.length !== activeMemberIds.length) {
    return "Give every active member one payout position.";
  }

  const remaining = new Set(activeMemberIds.map(String));

  for (const userId of payoutOrder) {
    if (!remaining.delete(String(userId))) {
      return "The payout order must include each active member exactly once.";
    }
  }

  return null;
}

module.exports = { validatePayoutOrder };