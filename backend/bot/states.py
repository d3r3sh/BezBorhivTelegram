from aiogram.fsm.state import State, StatesGroup


class AddLoan(StatesGroup):
    name = State()
    amount = State()
    input_mode = State()
    rate = State()
    monthly_payment = State()
    payments_count = State()
    first_date = State()


class RecordPayment(StatesGroup):
    choose_loan = State()
    choose_type = State()
    amount = State()
