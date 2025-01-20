#include <iostream>
#include <thread>
#include <chrono>

int main()
{
    while (true)
    {
        std::cout << "Hello, proj1_2!\n";
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }
    return 0;
}