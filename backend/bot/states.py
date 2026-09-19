from aiogram.fsm.state import State, StatesGroup


class RecordPayment(StatesGroup):
    choose_loan = State()
    choose_type = State()
    amount = State()
