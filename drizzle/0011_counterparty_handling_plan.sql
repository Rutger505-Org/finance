-- Counterparty handling `skip` is now `plan`: its lines are plan items.
UPDATE `counterparty` SET `handling` = 'plan' WHERE `handling` = 'skip';
